"""
ZenFi API Views — complete REST API with AI integration.

Endpoints:
  POST /api/signup/                     – Register user
  GET  /api/expenses/                   – List expenses (paginated)
  POST /api/expenses/                   – Add expense (triggers AI categorization)
  DEL  /api/expenses/<id>/              – Delete expense
  GET  /api/goals/                      – List goals
  POST /api/goals/                      – Create goal
  PUT  /api/goals/<id>/                 – Update goal
  DEL  /api/goals/<id>/                 – Delete goal
  GET  /api/goals/<id>/predict/         – AI goal prediction
  POST /api/chat/                       – AI chatbot (with history)
  GET  /api/chat/history/               – Get chat history for a session
  DEL  /api/chat/history/               – Clear chat history for a session
  GET  /api/insights/                   – Get AI insights (cached)
  POST /api/insights/refresh/           – Trigger new insight generation
  POST /api/insights/<id>/read/         – Mark insight as read
  POST /api/categorize/                 – AI categorize any text
  GET  /api/dashboard/                  – Aggregated dashboard data
  GET  /api/budget/                     – Get user's monthly budget
  PATCH /api/budget/                    – Update user's monthly budget
"""

import logging
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Expense, Goal, ChatMessage, AIInsight, Profile
from .serializers import (
    ExpenseSerializer, GoalSerializer,
    ChatMessageSerializer, ChatRequestSerializer,
    AIInsightSerializer, CategorizeRequestSerializer,
    GoalPredictionSerializer, RegisterSerializer,
    ProfileSerializer,
    NotificationSerializer,
    PurchaseAnalyzeSerializer,
    QuickExpenseSerializer,
)
from .utils import get_monthly_budget, get_monthly_total
from .purchase_analysis import analyze_purchase, extension_spending_summary
from .models import Notification
from .notification_service import create_notification
from .ai_service import (
    chat_with_ai, generate_financial_insights,
    categorize_expense, predict_goal_achievement,
    AIServiceError,
)

logger = logging.getLogger(__name__)


# ─── Auth ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    """Register a new user."""
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user = serializer.save()
    return Response(
        {'message': f'Account created for {user.username}. You can now log in.'},
        status=status.HTTP_201_CREATED,
    )


def _user_profile_response(user):
    return {
        'id':             user.id,
        'username':       user.username,
        'email':          user.email,
        'date_joined':    user.date_joined,
        'monthly_budget': get_monthly_budget(user),
    }


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):
    """Return or update the authenticated user's profile."""
    user = request.user

    if request.method == 'PATCH':
        profile, _ = Profile.objects.get_or_create(user=user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(
                {'error': True, 'detail': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer.save()
        return Response(_user_profile_response(user))

    return Response(_user_profile_response(user))


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def budget(request):
    """Get or update the authenticated user's monthly budget."""
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response({'monthly_budget': float(profile.monthly_budget)})

    serializer = ProfileSerializer(profile, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer.save()
    return Response({'monthly_budget': float(profile.monthly_budget)})

# ─── Expenses ─────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def expenses(request):
    if request.method == 'GET':
        category = request.query_params.get('category')
        qs = Expense.objects.filter(user=request.user)
        if category:
            qs = qs.filter(category=category)
        serializer = ExpenseSerializer(qs, many=True)
        return Response({
            'count':    qs.count(),
            'results':  serializer.data,
        })

    # POST – add new expense
    serializer = ExpenseSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    expense = serializer.save(user=request.user)
    # Notification: expense logged
    try:
        create_notification(
            user=request.user,
            type='info',
            priority='low',
            title='Expense logged',
            message=f'Saved ₹{float(expense.amount):,.0f} for \"{expense.description or expense.category}\".',
            data={'expense_id': expense.pk},
            dedupe_window_minutes=5,
        )
    except Exception:
        pass

    # ── Async: categorize expense + regenerate insights ────────────
    try:
        from .tasks import categorize_expense_task, generate_insights_for_user, send_budget_alert_task
        categorize_expense_task.delay(expense.pk)
        generate_insights_for_user.delay(request.user.pk)

        # Check budget threshold
        monthly_total = get_monthly_total(request.user)
        monthly_budget = get_monthly_budget(request.user)
        send_budget_alert_task.delay(request.user.pk, monthly_total, monthly_budget)
    except Exception as e:
        logger.warning("Could not dispatch async tasks: %s", e)

    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def expense_detail(request, pk):
    try:
        expense = Expense.objects.get(pk=pk, user=request.user)
    except Expense.DoesNotExist:
        return Response({'error': 'Expense not found'}, status=status.HTTP_404_NOT_FOUND)
    expense.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Goals ────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def goals(request):
    if request.method == 'GET':
        qs = Goal.objects.filter(user=request.user)
        serializer = GoalSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})

    serializer = GoalSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    goal = serializer.save(user=request.user)

    # Async: update predictions
    try:
        from .tasks import update_goal_predictions_task
        update_goal_predictions_task.delay(request.user.pk)
    except Exception as e:
        logger.warning("Could not dispatch goal prediction task: %s", e)

    return Response(GoalSerializer(goal).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def goal_detail(request, pk):
    try:
        goal = Goal.objects.get(pk=pk, user=request.user)
    except Goal.DoesNotExist:
        return Response({'error': 'Goal not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        goal.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method == 'GET':
        return Response(GoalSerializer(goal).data)

    partial = request.method == 'PATCH'
    serializer = GoalSerializer(goal, data=request.data, partial=partial)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer.save()
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def goal_predict(request, pk):
    """Run AI goal prediction and return the result (also updates the goal)."""
    try:
        goal = Goal.objects.get(pk=pk, user=request.user)
    except Goal.DoesNotExist:
        return Response({'error': 'Goal not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        prediction = predict_goal_achievement(goal)
    except Exception as exc:
        logger.exception("Goal prediction failed: %s", exc)
        return Response({'error': 'Prediction failed', 'detail': str(exc)}, status=503)

    # Persist prediction
    import datetime
    pred_date_str = prediction.get('predicted_date')
    try:
        goal.predicted_completion_date = (
            datetime.date.fromisoformat(pred_date_str) if pred_date_str else None
        )
        goal.on_track         = prediction.get('on_track')
        goal.monthly_required = prediction.get('monthly_required')
        goal.save(update_fields=['predicted_completion_date', 'on_track', 'monthly_required'])
    except Exception:
        pass

    return Response(prediction)


# ─── AI Chat ──────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_chat(request):
    """
    Multi-turn AI chatbot with full financial context.
    """
    req_serializer = ChatRequestSerializer(data=request.data)
    if not req_serializer.is_valid():
        return Response(
            {'error': True, 'detail': req_serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    question   = req_serializer.validated_data['question']
    session_id = req_serializer.validated_data['session_id']

    # Save user message
    ChatMessage.objects.create(
        user=request.user,
        session_id=session_id,
        role='user',
        content=question,
    )

    try:
        result = chat_with_ai(request.user, question, session_id)
    except AIServiceError as exc:
        return Response(
            {'error': True, 'detail': str(exc)},
            status=exc.status_code,
        )

    answer = result['answer']

    # Save assistant reply
    ChatMessage.objects.create(
        user=request.user,
        session_id=session_id,
        role='assistant',
        content=answer,
        model_used=result.get('model', 'gemini-1.5-flash'),
    )

    return Response({
        'answer':     answer,
        'session_id': session_id,
        'model':      result.get('model'),
    })


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def chat_history(request):
    """Get or clear chat history for a session."""
    session_id = request.query_params.get('session_id', 'default')

    if request.method == 'DELETE':
        deleted, _ = ChatMessage.objects.filter(
            user=request.user, session_id=session_id
        ).delete()
        return Response({'deleted': deleted})

    messages = ChatMessage.objects.filter(
        user=request.user, session_id=session_id
    ).order_by('created_at')
    serializer = ChatMessageSerializer(messages, many=True)
    return Response({'session_id': session_id, 'messages': serializer.data})


# ─── AI Insights ──────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def insights(request):
    """Return latest AI insights for the user."""
    filter_type = request.query_params.get('type')
    unread_only = request.query_params.get('unread') == 'true'

    qs = AIInsight.objects.filter(user=request.user)
    if filter_type:
        qs = qs.filter(type=filter_type)
    if unread_only:
        qs = qs.filter(is_read=False)

    serializer = AIInsightSerializer(qs[:20], many=True)
    return Response({
        'count':        qs.count(),
        'unread_count': qs.filter(is_read=False).count(),
        'results':      serializer.data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def insights_refresh(request):
    """Trigger async regeneration of AI insights."""
    try:
        from .tasks import generate_insights_for_user
        task = generate_insights_for_user.delay(request.user.pk)
        return Response({
            'message': 'Insight generation started.',
            'task_id': str(task.id),
        }, status=status.HTTP_202_ACCEPTED)
    except Exception as exc:
        # Fallback: generate synchronously
        try:
            raw = generate_financial_insights(request.user)
            AIInsight.objects.filter(user=request.user, is_read=False).delete()
            created = []
            for item in raw:
                ins = AIInsight.objects.create(
                    user=request.user,
                    type=item.get('type', 'general'),
                    title=item.get('title', 'Insight'),
                    message=item.get('message', ''),
                    data=item.get('data', {}),
                )
                created.append(ins.pk)
            return Response({'message': f'Generated {len(created)} insights (sync).', 'count': len(created)})
        except AIServiceError as ai_exc:
            return Response({'error': str(ai_exc)}, status=503)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_insight_read(request, pk):
    """Mark a specific insight as read."""
    try:
        insight = AIInsight.objects.get(pk=pk, user=request.user)
    except AIInsight.DoesNotExist:
        return Response({'error': 'Insight not found'}, status=status.HTTP_404_NOT_FOUND)
    insight.is_read = True
    insight.save(update_fields=['is_read'])
    return Response({'success': True, 'id': pk})


# ─── Smart Categorization ─────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def categorize(request):
    """AI-powered expense categorization."""
    serializer = CategorizeRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    result = categorize_expense(
        serializer.validated_data['description'],
        serializer.validated_data['amount'],
    )
    return Response(result)


# ─── Dashboard Aggregation ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """
    Single endpoint returning all data needed for the dashboard:
    stats, recent transactions, active goals, and unread insights.
    """
    user = request.user
    now  = timezone.now()

    # Monthly stats
    monthly_expenses = Expense.objects.filter(
        user=user, date__year=now.year, date__month=now.month
    )
    monthly_total   = float(sum(e.amount for e in monthly_expenses))
    monthly_budget  = get_monthly_budget(user)
    budget_used_pct = round((monthly_total / monthly_budget) * 100, 1) if monthly_budget else 0

    # Category breakdown
    cat_breakdown: dict[str, float] = {}
    for e in monthly_expenses:
        cat_breakdown[e.category] = cat_breakdown.get(e.category, 0) + float(e.amount)

    # Goals summary
    all_goals   = Goal.objects.filter(user=user)
    total_saved = float(sum(g.saved_amount for g in all_goals))

    # Recent transactions
    recent_txns = Expense.objects.filter(user=user)[:5]
    txn_data = ExpenseSerializer(recent_txns, many=True).data

    # Unread insights
    unread_insights = AIInsight.objects.filter(user=user, is_read=False)[:3]
    insight_data = AIInsightSerializer(unread_insights, many=True).data

    return Response({
        'stats': {
            'monthly_spent':    monthly_total,
            'monthly_budget':   monthly_budget,
            'budget_used_pct':  budget_used_pct,
            'budget_remaining': max(monthly_budget - monthly_total, 0),
            'total_saved':      total_saved,
            'active_goals':     all_goals.count(),
        },
        'category_breakdown':   cat_breakdown,
        'recent_transactions':  txn_data,
        'active_goals':         GoalSerializer(all_goals[:3], many=True).data,
        'unread_insights':      insight_data,
        'unread_insight_count': unread_insights.count(),
    })


# ─── Chrome Extension APIs ─────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def extension_summary(request):
    """Spending summary + goals for extension popup."""
    return Response(extension_spending_summary(request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extension_analyze_purchase(request):
    """Analyze a product page purchase against user finances."""
    serializer = PurchaseAnalyzeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    result = analyze_purchase(request.user, serializer.validated_data)
    try:
        if result.get('recommendation') == 'avoid':
            p = result.get('product', {})
            create_notification(
                user=request.user,
                type='extension',
                priority='high',
                title='Purchase warning',
                message=(result.get('ai_summary') or (result.get('insights') or [''])[0] or 'This purchase may hurt your budget.'),
                data={'product': p, 'score': result.get('recommendation_score')},
                dedupe_window_minutes=120,
            )
    except Exception:
        pass
    return Response(result)


# ─── Notifications API ────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications(request):
    """
    Query params:
      - status=unread|read|all (default all)
      - type=<type> (optional)
      - limit (default 50)
    """
    status_q = request.query_params.get('status', 'all')
    type_q = request.query_params.get('type')
    limit = int(request.query_params.get('limit', 50))

    qs = Notification.objects.filter(user=request.user)
    if status_q == 'unread':
        qs = qs.filter(is_read=False)
    elif status_q == 'read':
        qs = qs.filter(is_read=True)
    if type_q:
        qs = qs.filter(type=type_q)

    qs = qs.select_related('user')[:max(1, min(limit, 200))]
    return Response({'count': Notification.objects.filter(user=request.user).count(), 'results': NotificationSerializer(qs, many=True).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_read(request, pk):
    try:
        n = Notification.objects.get(pk=pk, user=request.user)
    except Notification.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    if not n.is_read:
        n.is_read = True
        n.save(update_fields=['is_read'])
    return Response({'success': True, 'id': pk})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notification_mark_all_read(request):
    updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'success': True, 'updated': updated})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def notification_delete(request, pk):
    deleted, _ = Notification.objects.filter(pk=pk, user=request.user).delete()
    if not deleted:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_unread_count(request):
    cnt = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({'unread_count': cnt})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extension_quick_expense(request):
    """Quick-add expense from extension popup."""
    serializer = QuickExpenseSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': True, 'detail': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    data = serializer.validated_data
    expense = Expense.objects.create(
        user=request.user,
        description=data['description'],
        amount=data['amount'],
        category=data.get('category', 'shopping'),
        is_essential=data.get('is_essential', False),
    )
    return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)