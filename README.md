# Zenfi

Zenfi is a comprehensive personal finance management platform that helps users track, analyze, and optimize their spending and savings. The project consists of a Django backend, a modern Vite/React frontend, and a browser extension for scraping purchase data from e-commerce sites like Amazon and Flipkart. Zenfi integrates with Gmail to automatically extract expense data from emails, provides AI-powered insights, and offers tools for budgeting, goal setting, and notifications.

## Features

- **Automated Expense Tracking:** Scrapes purchase data from Amazon, Flipkart, and Gmail receipts.
- **AI-Powered Analysis:** Uses AI to categorize expenses and provide actionable insights.
- **Budgeting & Goals:** Set budgets, track progress, and manage financial goals.
- **Notifications:** Get alerts for overspending, bill reminders, and goal milestones.
- **Modern Frontend:** Built with React and Vite for a fast, responsive user experience.
- **Browser Extension:** Easily import purchases from major e-commerce platforms.
- **Secure Authentication:** OAuth and encrypted storage for user data.

## Project Structure

- `zenfi/` — Django backend (core logic, models, APIs, Gmail integration, AI services)
- `zenfi-frontend/` — React frontend (UI, charts, dashboards, user flows)
- `extension/` — Browser extension (scrapers, popup UI, integration scripts)

## Getting Started

1. **Backend:**
   - Python 3.10+, Django, Celery, SQLite (default)
   - Install dependencies: `pip install -r requirements.txt`
   - Run server: `python manage.py runserver`

2. **Frontend:**
   - Node.js 18+, npm
   - Install dependencies: `npm install`
   - Run dev server: `npm run dev`

3. **Extension:**
   - Load `extension/` as an unpacked extension in your browser


## License

MIT License
