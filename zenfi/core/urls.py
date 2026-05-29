from django.urls import path
from . import views

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────
    path('signup/',                  views.signup,               name='signup'),
    path('me/',                      views.me,                   name='me'),
    path('budget/',                  views.budget,               name='budget'),

    # ── Expenses ──────────────────────────────────────────────────
    path('expenses/',                views.expenses,             name='expenses'),
    path('expenses/<int:pk>/',       views.expense_detail,       name='expense-detail'),
    path('add-expense/',             views.expenses,             name='add-expense'),  # Legacy alias

    # ── Goals ─────────────────────────────────────────────────────
    path('goals/',                   views.goals,                name='goals'),
    path('goals/<int:pk>/',          views.goal_detail,          name='goal-detail'),
    path('goals/<int:pk>/predict/',  views.goal_predict,         name='goal-predict'),

    # ── AI Chat ───────────────────────────────────────────────────
    path('chat/',                    views.ai_chat,              name='ai-chat'),
    path('chat/history/',            views.chat_history,         name='chat-history'),

    # ── AI Insights ───────────────────────────────────────────────
    path('insights/',                views.insights,             name='insights'),
    path('insights/refresh/',        views.insights_refresh,     name='insights-refresh'),
    path('insights/<int:pk>/read/',  views.mark_insight_read,    name='insight-read'),

    # ── Smart Categorization ──────────────────────────────────────
    path('categorize/',              views.categorize,           name='categorize'),

    # ── Dashboard ─────────────────────────────────────────────────
    path('dashboard/',               views.dashboard,            name='dashboard'),

    # ── Chrome Extension ──────────────────────────────────────────
    path('extension/summary/',       views.extension_summary,         name='ext-summary'),
    path('extension/analyze/',       views.extension_analyze_purchase, name='ext-analyze'),
    path('extension/quick-expense/', views.extension_quick_expense, name='ext-quick-expense'),

    # ── Notifications ─────────────────────────────────────────────
    path('notifications/',                 views.notifications,              name='notifications'),
    path('notifications/unread-count/',    views.notification_unread_count,  name='notifications-unread-count'),
    path('notifications/mark-all-read/',   views.notification_mark_all_read, name='notifications-mark-all-read'),
    path('notifications/<int:pk>/read/',   views.notification_mark_read,     name='notification-read'),
    path('notifications/<int:pk>/',        views.notification_delete,        name='notification-delete'),
]