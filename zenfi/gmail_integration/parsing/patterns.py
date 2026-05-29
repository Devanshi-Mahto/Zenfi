"""
Regex patterns for Indian transaction / order emails.
"""
import re

# Transactional subject keywords
SUBJECT_KEYWORDS = re.compile(
    r'(order|payment|debited|paid|invoice|receipt|transaction|upi|'
    r'subscription|renewal|purchase|successful|shipped|delivered|'
    r'confirm|alert|statement)',
    re.I,
)

# Amount patterns (INR)
AMOUNT_PATTERNS = [
    re.compile(r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)', re.I),
    re.compile(r'(?:debited|paid|charged|amount)\s*(?:of\s*)?(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)', re.I),
    re.compile(r'(?:total|grand\s+total|order\s+total)\s*[:\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)', re.I),
    re.compile(r'INR\s*([\d,]+(?:\.\d{1,2})?)', re.I),
]

ORDER_ID_PATTERNS = [
    re.compile(r'order\s*(?:id|#|no\.?)\s*[:\s]*([A-Z0-9\-]{6,32})', re.I),
    re.compile(r'order\s+([0-9]{3}-[0-9]{7}-[0-9]{7})', re.I),  # Amazon
    re.compile(r'transaction\s*(?:id|#)\s*[:\s]*([A-Z0-9\-]{8,40})', re.I),
]

PAYMENT_METHOD_PATTERNS = [
    (re.compile(r'\bupi\b', re.I), 'upi'),
    (re.compile(r'credit\s+card|debit\s+card', re.I), 'card'),
    (re.compile(r'net\s*banking', re.I), 'netbanking'),
    (re.compile(r'paytm|phonepe|gpay|google\s+pay', re.I), 'wallet'),
    (re.compile(r'cash\s+on\s+delivery|\bcod\b', re.I), 'cod'),
]

# Merchant detection from sender domain or body
MERCHANT_RULES = [
    (re.compile(r'amazon', re.I), 'Amazon', 'shopping'),
    (re.compile(r'flipkart', re.I), 'Flipkart', 'shopping'),
    (re.compile(r'swiggy', re.I), 'Swiggy', 'food'),
    (re.compile(r'zomato', re.I), 'Zomato', 'food'),
    (re.compile(r'uber', re.I), 'Uber', 'travel'),
    (re.compile(r'ola', re.I), 'Ola', 'travel'),
    (re.compile(r'netflix', re.I), 'Netflix', 'entertainment'),
    (re.compile(r'spotify', re.I), 'Spotify', 'entertainment'),
    (re.compile(r'google\s*play|play\s*store', re.I), 'Google Play', 'entertainment'),
    (re.compile(r'paytm', re.I), 'Paytm', 'bills'),
    (re.compile(r'phonepe', re.I), 'PhonePe', 'bills'),
    (re.compile(r'hdfc|icici|sbi|axis|kotak', re.I), 'Bank', 'bills'),
    (re.compile(r'bigbasket|blinkit|zepto|instamart', re.I), 'Groceries', 'food'),
    (re.compile(r'myntra', re.I), 'Myntra', 'shopping'),
    (re.compile(r'bookmyshow', re.I), 'BookMyShow', 'entertainment'),
]

AUTO_IMPORT_CONFIDENCE = 0.82
