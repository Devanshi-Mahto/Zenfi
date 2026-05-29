"""
Duplicate transaction detection.
"""
from datetime import timedelta
from django.utils import timezone

from ..models import ParsedExpense


def is_duplicate_expense(user, *, amount, merchant, order_id='', transaction_date=None) -> bool:
    """Check parsed + imported history for likely duplicates."""
    if order_id:
        if ParsedExpense.objects.filter(
            user=user,
            order_id=order_id,
            status__in=['pending', 'approved', 'imported'],
        ).exists():
            return True

    if not amount:
        return False

    qs = ParsedExpense.objects.filter(
        user=user,
        amount=amount,
        status__in=['pending', 'approved', 'imported'],
    )
    if merchant:
        qs = qs.filter(merchant__iexact=merchant)

    if transaction_date:
        window_start = transaction_date - timedelta(hours=48)
        window_end = transaction_date + timedelta(hours=48)
        qs = qs.filter(
            transaction_date__gte=window_start,
            transaction_date__lte=window_end,
        )
    else:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=7))

    return qs.exists()
