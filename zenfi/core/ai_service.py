"""
ZenFi AI Service Layer  (google-genai SDK)
==========================================
Handles all Gemini API interactions with:
- Structured prompt engineering
- Context injection (transactions + goals)
- Conversation history management
- JSON response parsing
- Graceful error handling
# """

# import os
# import json
# import logging
# from datetime import date, timedelta

# import google.generativeai as genai
# from google.genai import types

# logger = logging.getLogger(__name__)

# # ─── Configure Gemini ─────────────────────────────────────────────
# _API_KEY    = os.getenv('GEMINI_API_KEY', '')
# _MODEL_NAME = 'gemini-1.5-flash'

# _client = genai.Client(api_key=_API_KEY) if _API_KEY else None


# class AIServiceError(Exception):
#     def __init__(self, message: str, status_code: int = 503):
#         super().__init__(message)
#         self.status_code = status_code


# # ─── Generation Config ────────────────────────────────────────────

# def _gen_config(temperature=0.7, max_tokens=1024):
#     return types.GenerateContentConfig(
#         temperature=temperature,
#         top_p=0.95,
#         max_output_tokens=max_tokens,
#     )


# # ─── Context Builders ─────────────────────────────────────────────

# def _build_expense_context(user) -> str:
#     from .models import Expense
#     expenses = Expense.objects.filter(user=user).order_by('-date')[:50]
#     if not expenses.exists():
#         return "No expenses recorded yet."

#     category_totals: dict[str, float] = {}
#     lines = []
#     total = 0.0

#     for e in expenses:
#         amt = float(e.amount)
#         total += amt
#         category_totals[e.category] = category_totals.get(e.category, 0) + amt
#         lines.append(
#             f"  • {e.date.strftime('%Y-%m-%d')} | {e.category:15s} | ₹{amt:,.2f} | {e.description or '—'}"
#         )

#     breakdown = '\n'.join(
#         f"  {cat}: ₹{amt:,.2f} ({amt/total*100:.1f}%)"
#         for cat, amt in sorted(category_totals.items(), key=lambda x: -x[1])
#     )

#     return (
#         f"=== EXPENSE SUMMARY ===\n"
#         f"Total spent (last 50 transactions): ₹{total:,.2f}\n\n"
#         f"--- By Category ---\n{breakdown}\n\n"
#         f"--- Recent Transactions ---\n" + '\n'.join(lines[:20])
#     )


# def _build_goals_context(user) -> str:
#     from .models import Goal
#     goals = Goal.objects.filter(user=user)
#     if not goals.exists():
#         return "No savings goals set."

#     lines = []
#     today = date.today()
#     for g in goals:
#         days_left = (g.deadline - today).days
#         pct = g.progress_percentage()
#         lines.append(
#             f"  • {g.title} | Target: ₹{g.target_amount:,} | Saved: ₹{g.saved_amount:,} "
#             f"| Progress: {pct}% | Deadline: {g.deadline} ({days_left} days left)"
#         )
#     return "=== SAVINGS GOALS ===\n" + '\n'.join(lines)


# def _build_chat_history_context(user, session_id: str, limit: int = 10) -> list[dict]:
#     from .models import ChatMessage
#     messages = ChatMessage.objects.filter(
#         user=user, session_id=session_id
#     ).order_by('-created_at')[:limit]

#     history = []
#     for msg in reversed(messages):
#         history.append({
#             'role': 'user' if msg.role == 'user' else 'model',
#             'parts': [{'text': msg.content}],
#         })
#     return history


# # ─── System Prompt ────────────────────────────────────────────────

# SYSTEM_PROMPT = """You are ZenFi AI, a smart and empathetic personal finance assistant for Indian users.

# Your personality:
# - Friendly, concise, and actionable
# - Use ₹ (rupee) symbol for all amounts
# - Give specific numbers, not vague advice
# - Be encouraging but honest about financial risks

# Your capabilities:
# - Analyze spending patterns and detect overspending
# - Suggest savings strategies tailored to the user's goals
# - Predict goal achievement likelihood
# - Answer any personal finance question
# - Categorize expenses

# Rules:
# - Always ground advice in the user's actual data provided
# - If data is missing, ask the user for it
# - Keep responses under 200 words unless the user asks for detail
# - Format lists with bullet points
# - Never make up transaction data"""


# # ─── Core AI Functions ────────────────────────────────────────────

# def chat_with_ai(user, question: str, session_id: str = 'default') -> dict:
#     """Multi-turn AI chat with full user context injected."""
#     if not _client:
#         raise AIServiceError("Gemini API key not configured.", 503)

#     expense_ctx = _build_expense_context(user)
#     goals_ctx   = _build_goals_context(user)

#     context_block = (
#         f"{SYSTEM_PROMPT}\n\n"
#         f"=== USER FINANCIAL DATA ===\n"
#         f"{expense_ctx}\n\n"
#         f"{goals_ctx}\n\n"
#         f"=== USER QUESTION ===\n{question}"
#     )

#     # Build history as contents list
#     history = _build_chat_history_context(user, session_id)
#     contents = history + [{'role': 'user', 'parts': [{'text': context_block}]}]

#     try:
#         response = _client.models.generate_content(
#             model=_MODEL_NAME,
#             contents=contents,
#             config=_gen_config(temperature=0.7, max_tokens=1024),
#         )
#         answer = response.text.strip()
#     except Exception as exc:
#         logger.exception("Gemini chat error: %s", exc)
#         raise AIServiceError(f"AI service error: {exc}", 503) from exc

#     return {'answer': answer, 'session_id': session_id, 'model': _MODEL_NAME}


# def generate_financial_insights(user) -> list[dict]:
#     """Analyze spending/goals and return structured insight list."""
#     if not _client:
#         return _fallback_insights(user)

#     expense_ctx = _build_expense_context(user)
#     goals_ctx   = _build_goals_context(user)

#     prompt = f"""
# {SYSTEM_PROMPT}

# {expense_ctx}

# {goals_ctx}

# === TASK ===
# Analyze the user's financial data above and generate 3-5 actionable insights.

# Return ONLY a valid JSON array (no markdown, no explanation). Each object must have:
# - "type": one of ["overspending", "savings_tip", "goal_warning", "pattern", "general"]
# - "title": short title (max 8 words)
# - "message": actionable insight (2-3 sentences, use ₹ amounts)
# - "data": object with relevant numbers

# Example:
# [
#   {{
#     "type": "overspending",
#     "title": "Shopping Spend Up 45% This Month",
#     "message": "You spent ₹7,497 on shopping — 45% more than last month.",
#     "data": {{"amount": 7497, "category": "shopping", "increase_pct": 45}}
#   }}
# ]
# """

#     try:
#         response = _client.models.generate_content(
#             model=_MODEL_NAME,
#             contents=prompt,
#             config=_gen_config(temperature=0.4, max_tokens=1024),
#         )
#         raw = response.text.strip()
#         if raw.startswith('```'):
#             raw = raw.split('\n', 1)[1].rsplit('```', 1)[0]
#         insights = json.loads(raw)
#         if not isinstance(insights, list):
#             raise ValueError("Expected JSON array")
#         return insights
#     except Exception as exc:
#         logger.exception("Insight generation error: %s", exc)
#         return _fallback_insights(user)


# def categorize_expense(description: str, amount: float) -> dict:
#     """AI-powered expense categorization. Returns { category, confidence, reasoning }."""
#     valid = ['food', 'shopping', 'travel', 'bills', 'entertainment',
#              'health', 'education', 'investment', 'other']

#     if not _client:
#         return {'category': 'other', 'confidence': 0.5, 'reasoning': 'API not configured'}

#     prompt = f"""Categorize this Indian expense into exactly one of:
# {', '.join(valid)}

# Expense: "{description}"
# Amount: ₹{amount}

# Return ONLY valid JSON:
# {{"category": "<category>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>"}}"""

#     try:
#         response = _client.models.generate_content(
#             model=_MODEL_NAME,
#             contents=prompt,
#             config=_gen_config(temperature=0.1, max_tokens=128),
#         )
#         raw = response.text.strip().strip('```json').strip('```').strip()
#         result = json.loads(raw)
#         if result.get('category') not in valid:
#             result['category'] = 'other'
#         return result
#     except Exception as exc:
#         logger.exception("Categorization error: %s", exc)
#         return {'category': 'other', 'confidence': 0.5, 'reasoning': str(exc)}


# def predict_goal_achievement(goal) -> dict:
#     """Predict goal achievement and return structured prediction."""
#     from .models import Expense
#     user  = goal.user
#     today = date.today()
#     days_left = (goal.deadline - today).days
#     remaining = float(goal.target_amount) - float(goal.saved_amount)

#     if days_left <= 0:
#         return {'on_track': False, 'predicted_date': None,
#                 'monthly_required': None, 'confidence': 1.0,
#                 'advice': 'Goal deadline has passed. Consider extending it.'}

#     if remaining <= 0:
#         return {'on_track': True, 'predicted_date': str(today),
#                 'monthly_required': 0, 'confidence': 1.0,
#                 'advice': 'Goal already achieved! 🎉'}

#     months_left      = max(days_left / 30, 0.1)
#     monthly_required = round(remaining / months_left, 2)

#     thirty_days_ago = today - timedelta(days=30)
#     monthly_spending = sum(
#         float(e.amount)
#         for e in Expense.objects.filter(user=user, date__gte=thirty_days_ago)
#     )
#     estimated_monthly_savings = max(monthly_spending * 0.2, 1000)
#     on_track = estimated_monthly_savings >= monthly_required

#     months_to_complete = remaining / max(estimated_monthly_savings, 1)
#     predicted_date = today + timedelta(days=int(months_to_complete * 30))

#     # AI-enhanced advice
#     advice = f"Save ₹{monthly_required:,.0f}/month to reach your goal on time."
#     if _client:
#         try:
#             prompt = (
#                 f"Goal: {goal.title}. Need ₹{monthly_required:,.0f}/month. "
#                 f"Current savings rate: ₹{estimated_monthly_savings:,.0f}/month. "
#                 f"{'On track.' if on_track else 'Behind schedule.'} "
#                 "Give ONE actionable sentence of advice (max 25 words, include ₹ amount)."
#             )
#             response = _client.models.generate_content(
#                 model=_MODEL_NAME,
#                 contents=prompt,
#                 config=_gen_config(temperature=0.5, max_tokens=80),
#             )
#             advice = response.text.strip()
#         except Exception:
#             pass

#     return {
#         'on_track':         on_track,
#         'predicted_date':   str(predicted_date),
#         'monthly_required': monthly_required,
#         'confidence':       0.75,
#         'advice':           advice,
#     }


# # ─── Fallback ─────────────────────────────────────────────────────

# def _fallback_insights(user) -> list[dict]:
#     from .models import Expense
#     expenses = Expense.objects.filter(user=user)
#     if not expenses.exists():
#         return [{'type': 'general', 'title': 'Start Tracking Expenses',
#                  'message': 'Add your first expense to unlock AI-powered financial insights.',
#                  'data': {}}]

#     total = sum(float(e.amount) for e in expenses)
#     by_cat: dict[str, float] = {}
#     for e in expenses:
#         by_cat[e.category] = by_cat.get(e.category, 0) + float(e.amount)

#     top_cat, top_amt = max(by_cat.items(), key=lambda x: x[1])
#     pct = round(top_amt / total * 100, 1)

#     return [
#         {'type': 'pattern', 'title': f'Top Spend: {top_cat.title()}',
#          'message': f'Your biggest category is {top_cat} at ₹{top_amt:,.0f} ({pct}% of total).',
#          'data': {'category': top_cat, 'amount': top_amt, 'percentage': pct}},
#     ]

import os
import json
import logging
from datetime import date, timedelta
from google import genai

logger = logging.getLogger(__name__)

# ─── Configure Gemini ─────────────────────────────────────────────

_API_KEY = os.getenv("GEMINI_API_KEY", "")

_MODEL_NAME = "gemini-2.0-flash"

if _API_KEY:
    _client = genai.Client(api_key=_API_KEY)
else:
    _client = None

class AIServiceError(Exception):
    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


# ─── Context Builders ─────────────────────────────────────────────

def _build_expense_context(user) -> str:
    from .models import Expense

    expenses = Expense.objects.filter(user=user).order_by("-date")[:50]

    if not expenses.exists():
        return "No expenses recorded yet."

    category_totals = {}
    lines = []
    total = 0.0

    for e in expenses:
        amt = float(e.amount)
        total += amt

        category_totals[e.category] = (
            category_totals.get(e.category, 0) + amt
        )

        lines.append(
            f"• {e.date.strftime('%Y-%m-%d')} | "
            f"{e.category} | ₹{amt:,.2f} | "
            f"{e.description or '—'}"
        )

    breakdown = "\n".join(
        f"{cat}: ₹{amt:,.2f} ({amt / total * 100:.1f}%)"
        for cat, amt in sorted(
            category_totals.items(),
            key=lambda x: -x[1]
        )
    )

    return (
        f"=== EXPENSE SUMMARY ===\n"
        f"Total spent: ₹{total:,.2f}\n\n"
        f"--- By Category ---\n{breakdown}\n\n"
        f"--- Recent Transactions ---\n"
        + "\n".join(lines[:20])
    )


def _build_goals_context(user) -> str:
    from .models import Goal

    goals = Goal.objects.filter(user=user)

    if not goals.exists():
        return "No savings goals set."

    lines = []
    today = date.today()

    for g in goals:
        days_left = (g.deadline - today).days
        pct = g.progress_percentage()

        lines.append(
            f"• {g.title} | "
            f"Target: ₹{g.target_amount:,} | "
            f"Saved: ₹{g.saved_amount:,} | "
            f"Progress: {pct}% | "
            f"Deadline: {g.deadline} "
            f"({days_left} days left)"
        )

    return "=== SAVINGS GOALS ===\n" + "\n".join(lines)


def _build_chat_history_context(
    user,
    session_id: str,
    limit: int = 10
):
    from .models import ChatMessage

    messages = (
        ChatMessage.objects.filter(
            user=user,
            session_id=session_id
        )
        .order_by("-created_at")[:limit]
    )

    history = []

    for msg in reversed(messages):
        history.append(
            {
                "role": "user" if msg.role == "user" else "model",
                "parts": [msg.content],
            }
        )

    return history


# ─── System Prompt ────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are ZenFi AI, a smart and empathetic personal finance assistant for Indian users.

Your personality:
- Friendly
- Concise
- Actionable

Rules:
- Use ₹ for currency
- Keep responses under 200 words
- Give practical advice
- Never hallucinate financial data
"""


# ─── Helper Function ──────────────────────────────────────────────

def _generate_response(
    prompt,
    temperature=0.7,
    max_tokens=1024
):
    if not _client:
        raise AIServiceError(
            "Gemini API key not configured.",
            503
        )

    try:
        response = _client.models.generate_content(
            # prompt,
            # generation_config={
            #     "temperature": temperature,
            #     "top_p": 0.95,
            #     "max_output_tokens": max_tokens,
            # }
            model=_MODEL_NAME,
            contents=prompt,
        )

        return response.text.strip()

    except Exception as exc:
        logger.exception("Gemini Error: %s", exc)
        raise AIServiceError(
            f"AI service error: {exc}",
            503
        ) from exc


# ─── Chat Function ────────────────────────────────────────────────

def chat_with_ai(
    user,
    question: str,
    session_id: str = "default"
):
    expense_ctx = _build_expense_context(user)
    goals_ctx = _build_goals_context(user)

    prompt = f"""
{SYSTEM_PROMPT}

=== USER FINANCIAL DATA ===

{expense_ctx}

{goals_ctx}

=== USER QUESTION ===

{question}
"""

    answer = _generate_response(prompt)

    return {
        "answer": answer,
        "session_id": session_id,
        "model": _MODEL_NAME,
    }


# ─── Financial Insights ───────────────────────────────────────────

def generate_financial_insights(user):
    if not _client:
        return _fallback_insights(user)

    expense_ctx = _build_expense_context(user)
    goals_ctx = _build_goals_context(user)

    prompt = f"""
{SYSTEM_PROMPT}

{expense_ctx}

{goals_ctx}

Generate 3 financial insights.

Return ONLY valid JSON array.
"""

    try:
        raw = _generate_response(
            prompt,
            temperature=0.4
        )

        raw = raw.strip("```json").strip("```").strip()

        insights = json.loads(raw)

        if not isinstance(insights, list):
            raise ValueError("Expected JSON array")

        return insights

    except Exception as exc:
        logger.exception("Insight Error: %s", exc)
        return _fallback_insights(user)


# ─── Expense Categorization ───────────────────────────────────────

def categorize_expense(
    description: str,
    amount: float
):
    valid = [
        "food",
        "shopping",
        "travel",
        "bills",
        "entertainment",
        "health",
        "education",
        "investment",
        "other",
    ]

    if not _client:
        return {
            "category": "other",
            "confidence": 0.5,
            "reasoning": "API unavailable",
        }

    prompt = f"""
Categorize this expense.

Categories:
{", ".join(valid)}

Expense: "{description}"
Amount: ₹{amount}

Return ONLY JSON:
{{
  "category": "...",
  "confidence": 0.0,
  "reasoning": "..."
}}
"""

    try:
        raw = _generate_response(
            prompt,
            temperature=0.1,
            max_tokens=128
        )

        raw = raw.strip("```json").strip("```").strip()

        result = json.loads(raw)

        if result.get("category") not in valid:
            result["category"] = "other"

        return result

    except Exception as exc:
        logger.exception("Categorization Error: %s", exc)

        return {
            "category": "other",
            "confidence": 0.5,
            "reasoning": str(exc),
        }


# ─── Goal Prediction ──────────────────────────────────────────────

def predict_goal_achievement(goal):
    from .models import Expense

    user = goal.user
    today = date.today()

    days_left = (goal.deadline - today).days

    remaining = (
        float(goal.target_amount)
        - float(goal.saved_amount)
    )

    if days_left <= 0:
        return {
            "on_track": False,
            "predicted_date": None,
            "monthly_required": None,
            "confidence": 1.0,
            "advice": "Deadline passed.",
        }

    if remaining <= 0:
        return {
            "on_track": True,
            "predicted_date": str(today),
            "monthly_required": 0,
            "confidence": 1.0,
            "advice": "Goal achieved 🎉",
        }

    months_left = max(days_left / 30, 0.1)

    monthly_required = round(
        remaining / months_left,
        2
    )

    thirty_days_ago = today - timedelta(days=30)

    monthly_spending = sum(
        float(e.amount)
        for e in Expense.objects.filter(
            user=user,
            date__gte=thirty_days_ago
        )
    )

    estimated_monthly_savings = max(
        monthly_spending * 0.2,
        1000
    )

    on_track = (
        estimated_monthly_savings
        >= monthly_required
    )

    months_to_complete = (
        remaining
        / max(estimated_monthly_savings, 1)
    )

    predicted_date = today + timedelta(
        days=int(months_to_complete * 30)
    )

    advice = (
        f"Save ₹{monthly_required:,.0f}/month "
        f"to reach your goal."
    )

    return {
        "on_track": on_track,
        "predicted_date": str(predicted_date),
        "monthly_required": monthly_required,
        "confidence": 0.75,
        "advice": advice,
    }


# ─── Fallback Insights ────────────────────────────────────────────

def _fallback_insights(user):
    from .models import Expense

    expenses = Expense.objects.filter(user=user)

    if not expenses.exists():
        return [
            {
                "type": "general",
                "title": "Start Tracking",
                "message": (
                    "Add expenses to unlock insights."
                ),
                "data": {},
            }
        ]

    total = sum(float(e.amount) for e in expenses)

    by_cat = {}

    for e in expenses:
        by_cat[e.category] = (
            by_cat.get(e.category, 0)
            + float(e.amount)
        )

    top_cat, top_amt = max(
        by_cat.items(),
        key=lambda x: x[1]
    )

    pct = round(top_amt / total * 100, 1)

    return [
        {
            "type": "pattern",
            "title": f"Top Spend: {top_cat.title()}",
            "message": (
                f"Your highest spending is "
                f"{top_cat} at ₹{top_amt:,.0f} "
                f"({pct}% of total)."
            ),
            "data": {
                "category": top_cat,
                "amount": top_amt,
                "percentage": pct,
            },
        }
    ]


# ─── Extension: Purchase Analysis ─────────────────────────────────

def analyze_purchase_with_ai(user, product: dict, context: dict) -> str | None:
    """
    Return one concise AI purchase advisory line for the extension widget.
    """
    if not _client:
        return None

    ctx = context.get('spending_context', {})
    impacts = context.get('goal_impacts', [])[:2]
    impact_text = '; '.join(
        f"{i['goal_title']}: +{int(i['days_delayed'])} days"
        for i in impacts
    ) or 'none'

    prompt = f"""
{SYSTEM_PROMPT}

User considering purchase:
- Product: {product.get('title', '')[:120]}
- Price: ₹{product.get('price', 0):,.0f}
- Category: {product.get('category', 'shopping')}
- Site: {product.get('site', '')}

Financial context:
- Monthly spent: ₹{ctx.get('monthly_spent', 0):,.0f} / ₹{ctx.get('monthly_budget', 0):,.0f}
- Budget remaining: ₹{ctx.get('budget_remaining', 0):,.0f}
- Category spent this month: ₹{ctx.get('category_spent', 0):,.0f}
- Goal delays if bought: {impact_text}
- Rule-based score: {context.get('recommendation_score', 50)}/100

Write ONE sentence (max 25 words) of practical spending advice for this purchase.
No JSON. No bullet points.
"""

    try:
        return _generate_response(prompt, temperature=0.5, max_tokens=80)
    except Exception as exc:
        logger.debug('Purchase AI line failed: %s', exc)
        return None