"""
Optional Gemini extraction when regex fails.
"""
import json
import logging
import re

logger = logging.getLogger(__name__)


def parse_with_gemini(subject: str, body: str, sender: str) -> dict | None:
    try:
        from core.ai_service import _client, _generate_response, _MODEL_NAME
    except ImportError:
        return None

    if not _client:
        return None

    prompt = f"""
Extract payment/order details from this email. Return ONLY valid JSON:
{{
  "amount": number or null,
  "merchant": "string",
  "category": "food|shopping|travel|entertainment|bills|health|education|other",
  "order_id": "string or empty",
  "confidence": 0.0 to 1.0
}}

Sender: {sender}
Subject: {subject}
Body:
{body[:2500]}
"""

    try:
        raw = _generate_response(prompt, temperature=0.1, max_tokens=256)
        raw = raw.strip().strip('```json').strip('```').strip()
        data = json.loads(raw)
        if data.get('amount'):
            data['amount'] = float(str(data['amount']).replace(',', ''))
        return data
    except Exception as exc:
        logger.debug('Gemini email parse failed: %s', exc)
        return None
