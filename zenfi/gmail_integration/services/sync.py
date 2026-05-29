"""
Gmail inbox sync → ParsedExpense records → optional auto-import.
"""
import logging
from decimal import Decimal

from django.utils import timezone

from core.models import Expense, Profile
from ..models import GmailAccount, EmailSyncLog, ParsedExpense
from ..parsing import parse_email_message, is_duplicate_expense
from ..parsing.patterns import AUTO_IMPORT_CONFIDENCE
from .gmail_client import GmailClient, GmailClientError
from core.notification_service import create_notification

logger = logging.getLogger(__name__)


def sync_user_gmail(user, *, max_messages: int = 40) -> dict:
    """
    Scan Gmail, parse emails, create ParsedExpense rows.
    Auto-imports when confidence >= threshold and gmail_auto_sync enabled.
    """
    try:
        account = GmailAccount.objects.get(user=user, is_connected=True, sync_enabled=True)
    except GmailAccount.DoesNotExist:
        return {'status': 'error', 'message': 'Gmail not connected'}

    log = EmailSyncLog.objects.create(user=user, status='running')

    scanned = parsed_count = imported_count = 0
    errors = []

    try:
        client = GmailClient(account)
        messages = client.list_transactional_messages(max_results=max_messages)
        scanned = len(messages)

        existing_ids = set(
            ParsedExpense.objects.filter(user=user).values_list('gmail_message_id', flat=True)
        )

        profile, _ = Profile.objects.get_or_create(user=user)
        auto_sync = profile.gmail_auto_sync

        for msg in messages:
            mid = msg['message_id']
            if mid in existing_ids:
                continue

            parsed = parse_email_message(
                message_id=mid,
                subject=msg['subject'],
                sender=msg['sender'],
                body=msg['body'],
                snippet=msg['snippet'],
                internal_date_ms=msg['internal_date_ms'],
            )

            if parsed is None:
                continue

            if parsed.get('status') == 'failed' or not parsed.get('amount'):
                pe = _create_parsed(user, parsed, log, status='failed')
                parsed_count += 1
                continue

            if is_duplicate_expense(
                user,
                amount=parsed['amount'],
                merchant=parsed['merchant'],
                order_id=parsed.get('order_id', ''),
                transaction_date=parsed.get('transaction_date'),
            ):
                _create_parsed(user, parsed, log, status='duplicate')
                parsed_count += 1
                continue

            pe = _create_parsed(user, parsed, log, status='pending')
            parsed_count += 1

            if auto_sync and parsed['confidence'] >= AUTO_IMPORT_CONFIDENCE:
                try:
                    approve_parsed_expense(pe, auto=True)
                    imported_count += 1
                except Exception as exc:
                    errors.append(str(exc))

        account.last_sync_at = timezone.now()
        account.save(update_fields=['last_sync_at'])

        if parsed_count > 0:
            create_notification(
                user=user,
                type='gmail',
                priority='normal',
                title='New Gmail expenses detected',
                message=f'ZenFi found {parsed_count} new transaction email(s) in your inbox. Review and approve them.',
                data={'parsed_count': parsed_count, 'imported_count': imported_count},
                dedupe_window_minutes=60,
            )

        log.emails_scanned = scanned
        log.expenses_parsed = parsed_count
        log.expenses_imported = imported_count
        log.status = 'partial' if errors else 'success'
        log.finished_at = timezone.now()
        if errors:
            log.error_message = '; '.join(errors[:5])
        log.save()

        return {
            'status': log.status,
            'emails_scanned': scanned,
            'expenses_parsed': parsed_count,
            'expenses_imported': imported_count,
            'sync_log_id': log.pk,
        }

    except GmailClientError as exc:
        log.status = 'failed'
        log.error_message = str(exc)
        log.finished_at = timezone.now()
        log.save()
        return {'status': 'error', 'message': str(exc)}
    except Exception as exc:
        logger.exception('Gmail sync failed for user %s', user.pk)
        log.status = 'failed'
        log.error_message = str(exc)[:500]
        log.finished_at = timezone.now()
        log.save()
        return {'status': 'error', 'message': str(exc)[:300]}


def _create_parsed(user, data: dict, log: EmailSyncLog, status: str) -> ParsedExpense:
    return ParsedExpense.objects.create(
        user=user,
        gmail_message_id=data['gmail_message_id'],
        subject=data.get('subject', ''),
        sender=data.get('sender', ''),
        merchant=data.get('merchant', ''),
        amount=data.get('amount'),
        currency=data.get('currency', 'INR'),
        transaction_date=data.get('transaction_date'),
        payment_method=data.get('payment_method', 'unknown'),
        order_id=data.get('order_id', ''),
        category=data.get('category', 'other'),
        description=data.get('description', ''),
        confidence=data.get('confidence', 0),
        parse_method=data.get('parse_method', 'regex'),
        status=status,
        raw_snippet=data.get('raw_snippet', ''),
        sync_log=log,
    )


def approve_parsed_expense(
    parsed: ParsedExpense,
    *,
    auto: bool = False,
    category: str | None = None,
    amount: float | None = None,
    description: str | None = None,
) -> Expense:
    """Import parsed expense into core.Expense."""
    if parsed.status in ('imported', 'duplicate'):
        if parsed.expense_id:
            return parsed.expense
        raise ValueError('Already processed')

    final_amount = Decimal(str(amount if amount is not None else parsed.amount))
    final_category = category or parsed.category
    final_desc = description or parsed.description or parsed.merchant

    expense = Expense.objects.create(
        user=parsed.user,
        amount=final_amount,
        category=_map_category(final_category),
        description=final_desc,
        is_essential=False,
        source='gmail',
        gmail_message_id=parsed.gmail_message_id,
        date=parsed.transaction_date or timezone.now(),
    )

    parsed.expense = expense
    parsed.status = 'imported' if auto else 'approved'
    parsed.category = final_category
    if amount is not None:
        parsed.amount = final_amount
    parsed.save()

    try:
        from core.tasks import categorize_expense_task, generate_insights_for_user
        categorize_expense_task.delay(expense.pk)
        generate_insights_for_user.delay(parsed.user.pk)
    except Exception:
        pass

    return expense


def reject_parsed_expense(parsed: ParsedExpense) -> None:
    parsed.status = 'rejected'
    parsed.save(update_fields=['status', 'updated_at'])


def _map_category(cat: str) -> str:
    valid = {c[0] for c in Expense.CATEGORY_CHOICES}
    if cat in valid:
        return cat
    mapping = {
        'groceries': 'food',
        'subscriptions': 'bills',
        'healthcare': 'health',
    }
    return mapping.get(cat, 'other')
