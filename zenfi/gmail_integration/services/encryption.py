"""
Fernet encryption for OAuth tokens at rest.
"""
import base64
import hashlib
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet

    try:
        from cryptography.fernet import Fernet
    except ImportError:
        logger.warning('cryptography not installed — tokens stored with weak encoding')
        return None

    key = getattr(settings, 'GMAIL_TOKEN_ENCRYPTION_KEY', '') or settings.SECRET_KEY
    digest = hashlib.sha256(key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    _fernet = Fernet(fernet_key)
    return _fernet


def encrypt_token(plain: str) -> str:
    if not plain:
        return ''
    f = _get_fernet()
    if f is None:
        return base64.b64encode(plain.encode()).decode()
    return f.encrypt(plain.encode()).decode()


def decrypt_token(cipher: str) -> str:
    if not cipher:
        return ''
    f = _get_fernet()
    if f is None:
        try:
            return base64.b64decode(cipher.encode()).decode()
        except Exception:
            return cipher
    return f.decrypt(cipher.encode()).decode()
