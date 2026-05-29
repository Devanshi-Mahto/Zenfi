"""
Google OAuth 2.0 for Gmail read-only access.
"""
import secrets
import logging
from datetime import timedelta
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone

from ..models import GmailAccount, GmailToken, GmailOAuthState
from .encryption import encrypt_token

logger = logging.getLogger(__name__)

GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


def _oauth_config():
    client_id = getattr(settings, 'GMAIL_CLIENT_ID', '')
    client_secret = getattr(settings, 'GMAIL_CLIENT_SECRET', '')
    redirect_uri = getattr(settings, 'GMAIL_REDIRECT_URI', 'http://localhost:8000/api/gmail/callback/')
    if not client_id or not client_secret:
        raise ValueError(
            'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in environment / .env'
        )
    return client_id, client_secret, redirect_uri


def build_auth_url(user) -> tuple[str, str]:
    """Create OAuth state and return (authorization_url, state)."""
    from google_auth_oauthlib.flow import Flow

    client_id, client_secret, redirect_uri = _oauth_config()

    # Cleanup old states
    cutoff = timezone.now() - timedelta(minutes=15)
    GmailOAuthState.objects.filter(user=user, created_at__lt=cutoff).delete()

    state = secrets.token_urlsafe(32)
    GmailOAuthState.objects.create(user=user, state=state)

    flow = Flow.from_client_config(
        {
            'web': {
                'client_id': client_id,
                'client_secret': client_secret,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
                'redirect_uris': [redirect_uri],
            }
        },
        scopes=GMAIL_SCOPES,
        state=state,
    )
    flow.redirect_uri = redirect_uri

    auth_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
    )
    return auth_url, state


def exchange_code_for_tokens(user, code: str, state: str) -> GmailAccount:
    """Validate state and persist encrypted tokens."""
    from google_auth_oauthlib.flow import Flow

    try:
        oauth_state = GmailOAuthState.objects.select_related('user').get(state=state)
    except GmailOAuthState.DoesNotExist:
        raise ValueError('Invalid or expired OAuth state')

    user = oauth_state.user
    oauth_state.delete()

    client_id, client_secret, redirect_uri = _oauth_config()

    flow = Flow.from_client_config(
        {
            'web': {
                'client_id': client_id,
                'client_secret': client_secret,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
                'redirect_uris': [redirect_uri],
            }
        },
        scopes=GMAIL_SCOPES,
        state=state,
    )
    flow.redirect_uri = redirect_uri
    flow.fetch_token(code=code)

    creds = flow.credentials
    email = _fetch_gmail_address(creds)

    account, _ = GmailAccount.objects.update_or_create(
        user=user,
        defaults={
            'email': email,
            'is_connected': True,
            'sync_enabled': True,
        },
    )

    if not creds.refresh_token:
        logger.warning('Gmail connect for %s: no refresh_token — user may need to re-consent', user.username)

    refresh_enc = encrypt_token(creds.refresh_token or '')
    GmailToken.objects.update_or_create(
        account=account,
        defaults={
            'access_token_encrypted': encrypt_token(creds.token or ''),
            'refresh_token_encrypted': refresh_enc,
            'token_expiry': creds.expiry,
            'scopes': ' '.join(GMAIL_SCOPES),
        },
    )
    return account


def _fetch_gmail_address(creds) -> str:
    try:
        from googleapiclient.discovery import build
        service = build('gmail', 'v1', credentials=creds, cache_discovery=False)
        profile = service.users().getProfile(userId='me').execute()
        return profile.get('emailAddress', '')
    except Exception as exc:
        logger.warning('Could not fetch Gmail address: %s', exc)
        return ''


def disconnect_gmail(user) -> None:
    GmailAccount.objects.filter(user=user).update(is_connected=False, sync_enabled=False)
    try:
        account = GmailAccount.objects.get(user=user)
        GmailToken.objects.filter(account=account).delete()
    except GmailAccount.DoesNotExist:
        pass
