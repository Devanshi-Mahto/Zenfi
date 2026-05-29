# Gmail Auto Expense Tracking

Automatically imports transactions from Gmail order/payment emails into ZenFi.

## Architecture

```
gmail_integration/
├── models.py          # GmailAccount, GmailToken, ParsedExpense, EmailSyncLog
├── services/
│   ├── oauth.py       # Google OAuth 2.0
│   ├── encryption.py  # Fernet token encryption
│   ├── gmail_client.py
│   └── sync.py        # Inbox scan pipeline
├── parsing/
│   ├── patterns.py    # Regex rules
│   ├── extractor.py   # Parse engine
│   └── duplicates.py
├── ai/
│   └── fallback_parser.py  # Gemini when regex fails
├── tasks/
│   └── sync_tasks.py  # Celery (every 15 min)
└── api/
    ├── views.py
    └── urls.py
```

## Google Cloud Setup

1. Create a project at https://console.cloud.google.com
2. Enable **Gmail API**
3. Create **OAuth 2.0 Client ID** (Web application)
4. Authorized redirect URI:
   `http://localhost:8000/api/gmail/callback/`
5. Add to `.env`:

```env
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-secret
GMAIL_REDIRECT_URI=http://localhost:8000/api/gmail/callback/
GMAIL_TOKEN_ENCRYPTION_KEY=generate-a-random-32-char-key
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gmail/status/` | Connection status |
| GET | `/api/gmail/connect/` | OAuth URL |
| GET | `/api/gmail/callback/` | OAuth redirect (Google) |
| POST | `/api/gmail/disconnect/` | Revoke connection |
| POST | `/api/gmail/sync/` | Trigger inbox scan |
| GET | `/api/gmail/parsed/` | Pending parsed expenses |
| POST | `/api/gmail/parsed/<id>/` | Approve / reject |
| GET | `/api/gmail/sync-logs/` | Sync history |

## Celery Beat

```bash
celery -A zenfi worker -l info
celery -A zenfi beat -l info
```

Sync runs every **15 minutes** for all connected accounts.

## PostgreSQL (optional)

```env
POSTGRES_DB=zenfi
POSTGRES_USER=zenfi
POSTGRES_PASSWORD=secret
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

Without these vars, SQLite is used.

## Flow

1. User connects Gmail (read-only scope)
2. Celery or manual sync scans transactional emails
3. Regex extracts amount, merchant, order ID, category
4. Duplicates blocked by message ID + order ID + amount window
5. High-confidence items auto-import if `Profile.gmail_auto_sync=True`
6. Others appear in **Gmail Expenses** for approve/reject
