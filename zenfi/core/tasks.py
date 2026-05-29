"""
Celery async tasks for ZenFi AI features.
"""
import logging
from celery import shared_task
from django.db import models

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_insights_for_user(self, user_id: int):
    """
    Async task: generate AI financial insights for a user and persist them.
    Triggered after expense creation or on a schedule.
    """
    from django.contrib.auth.models import User
    from .models import AIInsight
    from .ai_service import generate_financial_insights, AIServiceError

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.error("User %s not found for insight generation", user_id)
        return {'status': 'error', 'message': 'User not found'}

    try:
        insights_data = generate_financial_insights(user)
        created = []

        # Remove old unread insights to avoid stale data (keep read ones)
        AIInsight.objects.filter(user=user, is_read=False).delete()

        for item in insights_data:
            insight = AIInsight.objects.create(
                user=user,
                type=item.get('type', 'general'),
                title=item.get('title', 'Financial Insight'),
                message=item.get('message', ''),
                data=item.get('data', {}),
            )
            created.append(insight.pk)

        logger.info("Created %d insights for user %s", len(created), user.username)
        return {'status': 'success', 'insights_created': len(created)}

    except AIServiceError as exc:
        logger.warning("AI service error for user %s: %s", user_id, exc)
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.exception("Unexpected error generating insights for user %s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=10)
def categorize_expense_task(self, expense_id: int):
    """
    Async task: auto-categorize an expense using AI after it's created.
    """
    from .models import Expense, CategorizationLog
    from .ai_service import categorize_expense, AIServiceError

    try:
        expense = Expense.objects.get(pk=expense_id)
    except Expense.DoesNotExist:
        logger.error("Expense %s not found for categorization", expense_id)
        return {'status': 'error'}

    try:
        result = categorize_expense(expense.description, float(expense.amount))
        suggested = result.get('category', 'other')
        confidence = result.get('confidence', 0.5)

        # Auto-apply if confidence is high enough
        if confidence >= 0.80 and suggested != expense.category:
            expense.ai_category = suggested
            expense.save(update_fields=['ai_category'])

        # Log the categorization
        CategorizationLog.objects.update_or_create(
            expense=expense,
            defaults={
                'original_text':      expense.description,
                'suggested_category': suggested,
                'confidence':         confidence,
                'accepted':           confidence >= 0.80,
            },
        )

        logger.info(
            "Expense %s categorized as '%s' (confidence %.2f)",
            expense_id, suggested, confidence
        )
        return {'status': 'success', 'category': suggested, 'confidence': confidence}

    except AIServiceError as exc:
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.exception("Categorization error for expense %s", expense_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2)
def update_goal_predictions_task(self, user_id: int):
    """
    Async task: update AI goal predictions for all of a user's goals.
    """
    from django.contrib.auth.models import User
    from .models import Goal
    from .ai_service import predict_goal_achievement
    import datetime

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return {'status': 'error', 'message': 'User not found'}

    goals = Goal.objects.filter(user=user)
    updated = 0

    for goal in goals:
        try:
            prediction = predict_goal_achievement(goal)
            pred_date_str = prediction.get('predicted_date')
            pred_date = (
                datetime.date.fromisoformat(pred_date_str)
                if pred_date_str else None
            )
            monthly_req = prediction.get('monthly_required')

            Goal.objects.filter(pk=goal.pk).update(
                on_track=prediction.get('on_track'),
                predicted_completion_date=pred_date,
                monthly_required=monthly_req,
            )
            updated += 1
        except Exception as exc:
            logger.warning("Failed to predict goal %s: %s", goal.pk, exc)

    logger.info("Updated predictions for %d/%d goals (user %s)", updated, goals.count(), user_id)
    return {'status': 'success', 'goals_updated': updated}


@shared_task
def send_budget_alert_task(user_id: int, spent: float, budget: float):
    """
    Async task: check if user exceeded budget threshold and create a warning insight.
    """
    from django.contrib.auth.models import User
    from .models import AIInsight
    from .notification_service import notify_budget_threshold

    pct = (spent / budget * 100) if budget else 0
    if pct < 80:
        return {'status': 'skipped', 'reason': 'Below threshold'}

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return {'status': 'error'}

    level = 'critical' if pct >= 100 else 'warning'
    title = (
        'Monthly Budget Exceeded! 🚨'
        if pct >= 100
        else f'Budget {pct:.0f}% Used ⚠️'
    )
    message = (
        f"You have spent ₹{spent:,.0f} — exceeding your ₹{budget:,.0f} budget by ₹{spent - budget:,.0f}. "
        "Review and cut non-essential spending immediately."
        if pct >= 100 else
        f"You have used ₹{spent:,.0f} ({pct:.0f}%) of your ₹{budget:,.0f} monthly budget. "
        f"Only ₹{budget - spent:,.0f} remaining — spend carefully."
    )

    # Avoid duplicate alerts
    if not AIInsight.objects.filter(
        user=user, type='overspending', is_read=False,
        title__startswith='Monthly Budget'
    ).exists():
        AIInsight.objects.create(
            user=user,
            type='overspending',
            title=title,
            message=message,
            data={'spent': spent, 'budget': budget, 'percentage': pct, 'level': level},
        )

    # Also create feed notification (deduped)
    notify_budget_threshold(user, spent=spent, budget=budget)

    return {'status': 'success', 'level': level, 'percentage': pct}


@shared_task
def scheduled_financial_checks():
    """
    Beat task: generate proactive notifications for all users.
    - budget threshold
    - goal deadlines
    - unusual weekly increase
    """
    from django.contrib.auth.models import User
    from django.utils import timezone
    from datetime import timedelta
    from .models import Goal, Expense
    from .utils import get_monthly_budget, get_monthly_total
    from .notification_service import notify_budget_threshold, create_notification

    now = timezone.now()
    users = User.objects.all()
    created = 0

    for user in users:
        # Budget check
        budget = get_monthly_budget(user)
        spent = get_monthly_total(user)
        before = created
        notify_budget_threshold(user, spent=spent, budget=budget)

        # Goal deadlines (next 30 days)
        soon = now.date() + timedelta(days=30)
        goals = Goal.objects.filter(user=user, deadline__lte=soon)
        for g in goals:
            remaining = max(float(g.target_amount) - float(g.saved_amount), 0)
            if remaining <= 0:
                continue
            n = create_notification(
                user=user,
                type='goal',
                priority='high',
                title='Goal deadline approaching',
                message=(
                    f'Your "{g.title}" goal deadline is near. You still need ₹{remaining:,.0f} to reach ₹{float(g.target_amount):,.0f}.'
                ),
                data={'goal_id': g.id, 'remaining': remaining, 'deadline': str(g.deadline)},
                dedupe_window_minutes=1440,
            )
            if n:
                created += 1

        # Unusual weekly increase
        last_7_start = now - timedelta(days=7)
        prev_7_start = now - timedelta(days=14)
        last7 = Expense.objects.filter(user=user, date__gte=last_7_start).aggregate(models.Sum('amount'))['amount__sum'] or 0
        prev7 = Expense.objects.filter(user=user, date__gte=prev_7_start, date__lt=last_7_start).aggregate(models.Sum('amount'))['amount__sum'] or 0
        last7 = float(last7)
        prev7 = float(prev7)
        if prev7 > 0 and last7 > prev7 * 1.3:
            inc = round((last7 - prev7) / prev7 * 100, 1)
            n = create_notification(
                user=user,
                type='unusual',
                priority='normal',
                title='Spending increased this week',
                message=f'Your last 7 days spending is up {inc}% vs the previous week (₹{prev7:,.0f} → ₹{last7:,.0f}).',
                data={'last7': last7, 'prev7': prev7, 'increase_pct': inc},
                dedupe_window_minutes=720,
            )
            if n:
                created += 1

    return {'status': 'success', 'created': created}
