# ZenFi Chrome Extension

AI-powered purchase assistant for **Amazon** and **Flipkart**. Detects product pages, analyzes spending against your ZenFi budget and goals, and shows real-time warnings.

## Setup

1. **Backend** — run Django on `http://localhost:8000` with migrations applied.
2. **Icons** (optional if missing):
   ```bash
   pip install Pillow
   python scripts/generate_icons.py
   ```
3. **Load extension** in Chrome:
   - `chrome://extensions` → Developer mode → **Load unpacked**
   - Select this `extension/` folder
4. **Sign in** via the extension popup (same username/password as the ZenFi web app).

## Architecture

```
extension/
├── manifest.json          # MV3
├── background.js          # Alarms, notifications, message hub
├── content.js             # Floating widget + analysis trigger
├── content.css            # Widget styles (dark theme)
├── popup.html / popup.js  # Summary, goals, quick expense, login
├── utils/                 # storage, sanitize, format, constants
├── services/api.js        # JWT + Django REST client
└── scrapers/              # Amazon & Flipkart product extraction
```

## API Endpoints (Django)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/login/` | JWT login |
| GET | `/api/extension/summary/` | Popup spending + goals |
| POST | `/api/extension/analyze/` | Purchase AI + rules analysis |
| POST | `/api/extension/quick-expense/` | Log expense from popup |

## Future hooks

- `scrapers/` — add Myntra, etc.
- `services/api.js` — price history, coupons
- `background.js` — price drop alerts

## Notes

- Scrapers depend on site DOM; Amazon/Flipkart layout changes may require selector updates.
- Set `API_BASE` in `utils/constants.js` for production.
- No API keys in the extension — Gemini runs only on the backend.
