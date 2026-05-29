"""
Celery tasks for periodic Gmail sync.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def sync_gmail_for_user(self, user_id: int):
    from django.contrib.auth.models import User
    from ..services.sync import sync_user_gmail

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return {'status': 'error', 'message': 'User not found'}

    return sync_user_gmail(user)


@shared_task
def sync_all_connected_gmail_accounts():
    """Beat task: sync every connected Gmail account."""
    from ..models import GmailAccount

    accounts = GmailAccount.objects.filter(is_connected=True, sync_enabled=True)
    queued = 0
    for account in accounts:
        sync_gmail_for_user.delay(account.user_id)
        queued += 1

    logger.info('Queued Gmail sync for %d accounts', queued)
    return {'queued': queued}
