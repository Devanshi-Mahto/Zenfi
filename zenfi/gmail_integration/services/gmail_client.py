"""
Gmail API client with token refresh.
"""
import base64
import logging
from datetime import datetime, timezone as dt_tz

from django.conf import settings
from django.utils import timezone

from ..models import GmailAccount, GmailToken
from .encryption import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

# Broader query — Gmail search is OR-friendly
GMAIL_QUERY = (
    'newer_than:30d ('
    'subject:order OR subject:payment OR subject:debited OR subject:paid OR '
    'subject:invoice OR subject:receipt OR subject:transaction OR subject:UPI OR '
    'subject:subscription OR subject:successful OR from:amazon OR from:flipkart OR '
    'from:swiggy OR from:zomato OR from:paytm OR from:phonepe'
    ')'
)


class GmailClientError(Exception):
    pass


class GmailClient:
    def __init__(self, account: GmailAccount):
        self.account = account
        self._service = None

    def _load_credentials(self):
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        client_id = getattr(settings, 'GMAIL_CLIENT_ID', '') or ''
        client_secret = getattr(settings, 'GMAIL_CLIENT_SECRET', '') or ''
        if not client_id or not client_secret:
            raise GmailClientError(
                'Gmail API is not configured on the server. '
                'Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to zenfi/.env and restart Django.'
            )

        try:
            token_row = self.account.token
        except GmailToken.DoesNotExist:
            raise GmailClientError('Gmail tokens not found. Disconnect and reconnect Gmail in Settings.')

        access = decrypt_token(token_row.access_token_encrypted)
        refresh = decrypt_token(token_row.refresh_token_encrypted) or None
        if not access:
            raise GmailClientError('Invalid Gmail token. Please reconnect Gmail in Settings.')

        scope = (token_row.scopes or 'https://www.googleapis.com/auth/gmail.readonly').split()
        creds = Credentials(
            token=access,
            refresh_token=refresh,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=client_id,
            client_secret=client_secret,
            scopes=scope,
        )

        # Proactive refresh using stored expiry or creds.expired
        needs_refresh = creds.expired
        if token_row.token_expiry and timezone.is_aware(token_row.token_expiry):
            needs_refresh = needs_refresh or timezone.now() >= token_row.token_expiry

        if needs_refresh:
            if not creds.refresh_token:
                raise GmailClientError(
                    'Gmail access expired and no refresh token is stored. '
                    'Disconnect Gmail in Settings, then connect again (choose Allow on the consent screen).'
                )
            try:
                creds.refresh(Request())
            except Exception as exc:
                err = str(exc).lower()
                if 'invalid_grant' in err or 'revoked' in err:
                    raise GmailClientError(
                        'Gmail authorization expired. Disconnect and reconnect Gmail in Settings.'
                    ) from exc
                raise GmailClientError(f'Could not refresh Gmail token: {exc}') from exc

            token_row.access_token_encrypted = encrypt_token(creds.token or '')
            token_row.token_expiry = creds.expiry
            token_row.save(update_fields=['access_token_encrypted', 'token_expiry', 'updated_at'])

        return creds

    def _service_api(self):
        if self._service is None:
            from googleapiclient.discovery import build
            creds = self._load_credentials()
            self._service = build('gmail', 'v1', credentials=creds, cache_discovery=False)
        return self._service

    def list_transactional_messages(self, max_results: int = 50) -> list[dict]:
        service = self._service_api()
        try:
            result = service.users().messages().list(
                userId='me',
                q=GMAIL_QUERY,
                maxResults=max_results,
            ).execute()
        except Exception as exc:
            if '429' in str(exc) or 'rateLimit' in str(exc).lower():
                raise GmailClientError('Gmail API rate limit exceeded. Try again later.') from exc
            if '401' in str(exc) or 'invalid_grant' in str(exc).lower():
                raise GmailClientError('Gmail token expired. Please reconnect.') from exc
            raise GmailClientError(str(exc)) from exc

        messages = result.get('messages', [])
        full_messages = []

        for meta in messages:
            try:
                msg = service.users().messages().get(
                    userId='me', id=meta['id'], format='full',
                ).execute()
                full_messages.append(self._normalize_message(msg))
            except Exception as exc:
                logger.warning('Skip message %s: %s', meta.get('id'), exc)

        return full_messages

    def _normalize_message(self, msg: dict) -> dict:
        headers = {h['name'].lower(): h['value'] for h in msg.get('payload', {}).get('headers', [])}
        subject = headers.get('subject', '')
        sender = headers.get('from', '')
        body = self._extract_body(msg.get('payload', {}))
        snippet = msg.get('snippet', '')

        return {
            'message_id': msg['id'],
            'subject': subject,
            'sender': sender,
            'body': body,
            'snippet': snippet,
            'internal_date_ms': int(msg.get('internalDate', 0)),
        }

    def _extract_body(self, payload: dict) -> str:
        texts = []

        def walk(part):
            if not part:
                return
            mime = part.get('mimeType', '')
            body = part.get('body', {})
            data = body.get('data')
            if data and mime in ('text/plain', 'text/html'):
                try:
                    decoded = base64.urlsafe_b64decode(data + '==').decode('utf-8', errors='ignore')
                    if mime == 'text/html':
                        decoded = _strip_html(decoded)
                    texts.append(decoded)
                except Exception:
                    pass
            for child in part.get('parts', []):
                walk(child)

        walk(payload)
        return '\n'.join(texts)[:15000]


def _strip_html(html: str) -> str:
    import re
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.I | re.S)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.I | re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()
