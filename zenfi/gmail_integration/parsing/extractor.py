"""
Email body/subject parsing — regex first, optional AI fallback.
"""
import re
import logging
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any

from .patterns import (
    SUBJECT_KEYWORDS,
    AMOUNT_PATTERNS,
    ORDER_ID_PATTERNS,
    PAYMENT_METHOD_PATTERNS,
    MERCHANT_RULES,
)

logger = logging.getLogger(__name__)


def _parse_amount(text: str) -> float | None:
    for pattern in AMOUNT_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            amounts = []
            for m in matches:
                try:
                    amounts.append(float(str(m).replace(',', '')))
                except ValueError:
                    continue
            if amounts:
                return max(amounts)
    return None


def _parse_order_id(text: str) -> str:
    for pattern in ORDER_ID_PATTERNS:
        m = pattern.search(text)
        if m:
            return m.group(1).strip()[:128]
    return ''


def _parse_payment_method(text: str) -> str:
    for pattern, method in PAYMENT_METHOD_PATTERNS:
        if pattern.search(text):
            return method
    return 'unknown'


def categorize_merchant(sender: str, subject: str, body: str) -> tuple[str, str]:
    """Return (merchant_name, category)."""
    combined = f'{sender} {subject} {body}'
    for pattern, merchant, category in MERCHANT_RULES:
        if pattern.search(combined):
            return merchant, category
    # Domain from sender
    m = re.search(r'@([\w.-]+)', sender)
    if m:
        domain = m.group(1).split('.')[0].title()
        return domain, 'other'
    return 'Unknown Merchant', 'other'


def _confidence_score(amount, merchant, subject_match, order_id) -> float:
    score = 0.0
    if amount and amount > 0:
        score += 0.45
    if merchant and merchant != 'Unknown Merchant':
        score += 0.25
    if subject_match:
        score += 0.2
    if order_id:
        score += 0.1
    return min(round(score, 2), 1.0)


def parse_email_message(
    *,
    message_id: str,
    subject: str,
    sender: str,
    body: str,
    snippet: str = '',
    internal_date_ms: int | None = None,
    use_ai_fallback: bool = True,
) -> dict[str, Any] | None:
    """
    Parse a single email into structured expense data.
    Returns None if email doesn't look transactional.
    """
    subject = subject or ''
    body = body or snippet or ''
    combined = f'{subject}\n{body}'

    # Match subject, snippet, or known merchant senders
    header_blob = f'{subject} {sender} {snippet[:300]}'
    if not SUBJECT_KEYWORDS.search(header_blob) and not SUBJECT_KEYWORDS.search(body[:800]):
        return None

    amount = _parse_amount(combined)
    merchant, category = categorize_merchant(sender, subject, body)
    order_id = _parse_order_id(combined)
    payment_method = _parse_payment_method(combined)

    subject_match = bool(SUBJECT_KEYWORDS.search(subject))
    confidence = _confidence_score(amount, merchant, subject_match, order_id)
    parse_method = 'regex'

    if (not amount or confidence < 0.5) and use_ai_fallback:
        ai_data = _ai_fallback_parse(subject, body, sender)
        if ai_data:
            amount = amount or ai_data.get('amount')
            merchant = ai_data.get('merchant') or merchant
            category = ai_data.get('category') or category
            order_id = order_id or ai_data.get('order_id', '')
            confidence = max(confidence, ai_data.get('confidence', 0.6))
            parse_method = 'hybrid' if amount else 'ai'

    if not amount or amount <= 0:
        return {
            'gmail_message_id': message_id,
            'subject': subject[:500],
            'sender': sender[:255],
            'merchant': merchant,
            'amount': None,
            'currency': 'INR',
            'category': category,
            'payment_method': payment_method,
            'order_id': order_id,
            'description': f'{merchant} — {subject[:200]}',
            'confidence': 0.2,
            'parse_method': 'failed',
            'raw_snippet': snippet[:2000],
            'transaction_date': _parse_date(internal_date_ms),
            'status': 'failed',
        }

    return {
        'gmail_message_id': message_id,
        'subject': subject[:500],
        'sender': sender[:255],
        'merchant': merchant,
        'amount': round(float(amount), 2),
        'currency': 'INR',
        'category': category,
        'payment_method': payment_method,
        'order_id': order_id,
        'description': f'{merchant} — {subject[:200]}',
        'confidence': confidence,
        'parse_method': parse_method,
        'raw_snippet': snippet[:2000],
        'transaction_date': _parse_date(internal_date_ms),
        'status': 'pending',
    }


def _parse_date(internal_date_ms: int | None):
    if internal_date_ms:
        try:
            return datetime.fromtimestamp(internal_date_ms / 1000)
        except (ValueError, OSError):
            pass
    return None


def _ai_fallback_parse(subject: str, body: str, sender: str) -> dict | None:
    try:
        from ..ai.fallback_parser import parse_with_gemini
        return parse_with_gemini(subject, body[:3000], sender)
    except Exception as exc:
        logger.debug('AI parse fallback skipped: %s', exc)
        return None
