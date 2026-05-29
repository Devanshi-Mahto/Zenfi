from django.contrib import admin
from .models import GmailAccount, GmailToken, ParsedExpense, EmailSyncLog, GmailOAuthState


@admin.register(GmailAccount)
class GmailAccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'email', 'is_connected', 'last_sync_at', 'sync_enabled')
    search_fields = ('user__username', 'email')


@admin.register(ParsedExpense)
class ParsedExpenseAdmin(admin.ModelAdmin):
    list_display = ('merchant', 'amount', 'category', 'status', 'confidence', 'user', 'transaction_date')
    list_filter = ('status', 'category', 'parse_method')
    search_fields = ('merchant', 'subject', 'order_id')


@admin.register(EmailSyncLog)
class EmailSyncLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'emails_scanned', 'expenses_parsed', 'started_at')
    list_filter = ('status',)
