"""
Notification creation helpers + generators.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.utils import timezone

from .models import Notification


def create_notification(
    *,
    user,
    title: str,
    message: str,
    type: str = 'info',
    priority: str = 'normal',
    data: dict[str, Any] | None = None,
    dedupe_window_minutes: int = 360,
) -> Notification | None:
    """
    Create a notification with lightweight dedupe.
    Dedupe avoids spamming identical notifications within a time window.
    """
    data = data or {}
    since = timezone.now() - timedelta(minutes=dedupe_window_minutes)
    exists = Notification.objects.filter(
        user=user,
        type=type,
        title=title,
        message=message,
        created_at__gte=since,
    ).exists()
    if exists:
        return None
    return Notification.objects.create(
        user=user,
        title=title[:255],
        message=message,
        type=type,
        priority=priority,
        data=data,
    )


def notify_budget_threshold(user, *, spent: float, budget: float) -> None:
    pct = (spent / budget * 100) if budget else 0
    if pct < 75:
        return

    if pct >= 100:
        create_notification(
            user=user,
            type='overspending',
            priority='critical',
            title='Monthly budget exceeded',
            message=(
                f'You have spent ₹{spent:,.0f} — exceeding your ₹{budget:,.0f} budget by ₹{spent - budget:,.0f}.'
            ),
            data={'spent': spent, 'budget': budget, 'pct': pct},
        )
        return

    level = 'high' if pct >= 90 else 'normal'
    create_notification(
        user=user,
        type='budget',
        priority=level,
        title=f'Budget alert — {pct:.0f}% used',
        message=(
            f'You have used ₹{spent:,.0f} ({pct:.0f}%) of your ₹{budget:,.0f} monthly budget. '
            f'₹{max(budget - spent, 0):,.0f} remaining.'
        ),
        data={'spent': spent, 'budget': budget, 'pct': pct},
    )

