"""
Purchase analysis for ZenFi Chrome extension.
Combines rule-based financial checks with optional AI enrichment.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import Any

from django.utils import timezone

from .models import Expense, Goal
from .utils import get_monthly_budget, get_monthly_total

logger = logging.getLogger(__name__)

# Map shopping-site categories → ZenFi expense categories
SITE_CATEGORY_MAP = {
    'electronics': 'shopping',
    'gadgets': 'shopping',
    'computers': 'shopping',
    'mobile': 'shopping',
    'fashion': 'shopping',
    'clothing': 'shopping',
    'home': 'shopping',
    'kitchen': 'shopping',
    'books': 'education',
    'grocery': 'food',
    'food': 'food',
    'beauty': 'shopping',
    'sports': 'entertainment',
    'toys': 'entertainment',
    'automotive': 'travel',
}


def sanitize_product(data: dict) -> dict:
    """Strip and bound product fields from extension scrape."""
    title = str(data.get('title', 'Unknown product'))[:300]
    title = re.sub(r'[<>"\']', '', title).strip() or 'Unknown product'

    price_raw = data.get('price', 0)
    try:
        price = float(price_raw)
    except (TypeError, ValueError):
        price = 0.0
    price = max(0.0, min(price, 50_000_000))

    url = str(data.get('url', ''))[:500]
    image = str(data.get('image', ''))[:500]
    site = str(data.get('site', ''))[:32]
    category = str(data.get('category', ''))[:80].lower().strip()

    mapped = SITE_CATEGORY_MAP.get(category, 'shopping')
    if not category:
        mapped = 'shopping'

    return {
        'title': title,
        'price': price,
        'category': mapped,
        'site_category': category,
        'url': url,
        'image': image,
        'site': site,
    }


def _category_spending(user, category: str, year=None, month=None) -> float:
    now = timezone.now()
    year = year or now.year
    month = month or now.month
    expenses = Expense.objects.filter(
        user=user,
        category=category,
        date__year=year,
        date__month=month,
    )
    return float(sum(e.amount for e in expenses))


def _weekly_category_limit(monthly_budget: float, category: str) -> float:
    """Rough weekly cap: shopping 25%, entertainment 15%, else 10% of monthly budget."""
    pct = {
        'shopping': 0.25,
        'entertainment': 0.15,
        'food': 0.20,
    }.get(category, 0.10)
    return (monthly_budget * pct) / 4


def _goal_impacts(user, price: float) -> list[dict]:
    today = date.today()
    impacts = []
    goals = Goal.objects.filter(user=user).order_by('deadline')[:5]

    for goal in goals:
        remaining = max(float(goal.target_amount) - float(goal.saved_amount), 0)
        if remaining <= 0:
            continue
        days_left = max((goal.deadline - today).days, 1)
        daily_needed = remaining / days_left
        if daily_needed <= 0:
            continue
        days_delayed = round(price / daily_needed, 1)
        if days_delayed < 0.5:
            continue
        impacts.append({
            'goal_id': goal.id,
            'goal_title': goal.title,
            'days_delayed': days_delayed,
            'remaining': round(remaining, 2),
            'deadline': str(goal.deadline),
        })

    impacts.sort(key=lambda x: x['days_delayed'], reverse=True)
    return impacts[:3]


def _recommendation_score(
    price: float,
    budget_remaining: float,
    budget_used_pct: float,
    category_spent: float,
    weekly_limit: float,
    goal_impacts: list,
) -> int:
    score = 100
    if price <= 0:
        return 50

    if price > budget_remaining:
        score -= 45
    elif price > budget_remaining * 0.5:
        score -= 25

    if budget_used_pct >= 90:
        score -= 20
    elif budget_used_pct >= 75:
        score -= 10

    if category_spent + price > weekly_limit * 4:
        score -= 15
    elif category_spent + price > weekly_limit:
        score -= 10

    if goal_impacts and goal_impacts[0]['days_delayed'] >= 14:
        score -= 20
    elif goal_impacts and goal_impacts[0]['days_delayed'] >= 7:
        score -= 12
    elif goal_impacts and goal_impacts[0]['days_delayed'] >= 3:
        score -= 6

    return max(0, min(100, score))


def _recommendation_label(score: int) -> str:
    if score >= 70:
        return 'approve'
    if score >= 45:
        return 'caution'
    return 'avoid'


def analyze_purchase(user, product_data: dict) -> dict[str, Any]:
    """
    Analyze a potential purchase against user finances.
    Returns structured insights for extension UI.
    """
    product = sanitize_product(product_data)
    price = product['price']
    category = product['category']

    monthly_budget = get_monthly_budget(user)
    monthly_spent = get_monthly_total(user)
    budget_remaining = max(monthly_budget - monthly_spent, 0)
    budget_used_pct = round((monthly_spent / monthly_budget) * 100, 1) if monthly_budget else 0

    category_spent = _category_spending(user, category)
    weekly_limit = _weekly_category_limit(monthly_budget, category)
    weekly_spent = category_spent / max(timezone.now().day / 7, 1)

    goal_impacts = _goal_impacts(user, price) if price > 0 else []

    insights: list[str] = []
    warnings: list[str] = []

    if price <= 0:
        insights.append('Could not detect a valid price on this page. Open the product detail page and try again.')
    else:
        cat_label = category.replace('_', ' ')
        if category_spent > 0:
            insights.append(
                f'You already spent ₹{category_spent:,.0f} on {cat_label} this month.'
            )

        if budget_used_pct >= 90:
            warnings.append('budget_critical')
            insights.append(
                f'You are close to reaching your monthly spending limit ({budget_used_pct}% used).'
            )
        elif budget_used_pct >= 75:
            warnings.append('budget_warning')
            insights.append(
                f'You have used {budget_used_pct}% of your ₹{monthly_budget:,.0f} monthly budget.'
            )

        if price > budget_remaining:
            warnings.append('over_budget')
            insights.append(
                f'This purchase (₹{price:,.0f}) exceeds your remaining monthly budget of ₹{budget_remaining:,.0f}.'
            )

        if weekly_spent + price > weekly_limit:
            warnings.append('weekly_category')
            insights.append(
                f'This purchase may exceed your weekly {cat_label} budget (≈₹{weekly_limit:,.0f}/week).'
            )

        for impact in goal_impacts[:2]:
            days = impact['days_delayed']
            if days >= 1:
                insights.append(
                    f'Buying this may delay your "{impact["goal_title"]}" savings goal by about {int(days)} days.'
                )

        if not insights:
            insights.append(
                f'After this purchase you would have ₹{max(budget_remaining - price, 0):,.0f} '
                f'left in your ₹{monthly_budget:,.0f} monthly budget.'
            )

    score = _recommendation_score(
        price, budget_remaining, budget_used_pct,
        category_spent, weekly_limit, goal_impacts,
    )
    recommendation = _recommendation_label(score)

    result = {
        'product': product,
        'insights': insights,
        'warnings': warnings,
        'recommendation_score': score,
        'recommendation': recommendation,
        'goal_impacts': goal_impacts,
        'spending_context': {
            'monthly_spent': monthly_spent,
            'monthly_budget': monthly_budget,
            'budget_remaining': budget_remaining,
            'budget_used_pct': budget_used_pct,
            'category_spent': category_spent,
            'category': category,
            'weekly_category_limit': round(weekly_limit, 2),
        },
        'ai_summary': None,
    }

    try:
        from .ai_service import analyze_purchase_with_ai
        ai_line = analyze_purchase_with_ai(user, product, result)
        if ai_line:
            result['ai_summary'] = ai_line
            if ai_line not in insights:
                insights.insert(0, ai_line)
    except Exception as exc:
        logger.debug('AI purchase analysis skipped: %s', exc)

    return result


def extension_spending_summary(user) -> dict[str, Any]:
    """Lightweight summary for extension popup."""
    now = timezone.now()
    monthly_budget = get_monthly_budget(user)
    monthly_spent = get_monthly_total(user)
    today = now.date()

    today_expenses = Expense.objects.filter(
        user=user, date__date=today,
    )
    today_spent = float(sum(e.amount for e in today_expenses))

    goals = Goal.objects.filter(user=user).order_by('-created_at')[:5]
    goals_data = [
        {
            'id': g.id,
            'title': g.title,
            'progress': g.progress_percentage(),
            'saved_amount': float(g.saved_amount),
            'target_amount': float(g.target_amount),
        }
        for g in goals
    ]

    return {
        'today_spent': today_spent,
        'monthly_spent': monthly_spent,
        'monthly_budget': monthly_budget,
        'budget_remaining': max(monthly_budget - monthly_spent, 0),
        'budget_used_pct': round((monthly_spent / monthly_budget) * 100, 1) if monthly_budget else 0,
        'active_goals': goals_data,
        'username': user.username,
    }
