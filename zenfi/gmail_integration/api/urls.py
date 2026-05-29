from django.urls import path
from . import views

urlpatterns = [
    path('status/',           views.gmail_status,           name='gmail-status'),
    path('connect/',          views.gmail_connect,          name='gmail-connect'),
    path('callback/',         views.gmail_callback,         name='gmail-callback'),
    path('disconnect/',       views.gmail_disconnect,       name='gmail-disconnect'),
    path('reconnect/',        views.gmail_reconnect,       name='gmail-reconnect'),
    path('settings/',         views.gmail_settings,        name='gmail-settings'),
    path('sync/',             views.gmail_sync,             name='gmail-sync'),
    path('parsed/',           views.parsed_expenses_list,   name='gmail-parsed-list'),
    path('parsed/<int:pk>/',  views.parsed_expense_detail,  name='gmail-parsed-detail'),
    path('sync-logs/',        views.sync_logs,              name='gmail-sync-logs'),
]
