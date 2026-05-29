from rest_framework import serializers
from ..models import GmailAccount, ParsedExpense, EmailSyncLog


class GmailStatusSerializer(serializers.Serializer):
    connected = serializers.BooleanField()
    email = serializers.EmailField(allow_blank=True)
    last_sync_at = serializers.DateTimeField(allow_null=True)
    sync_enabled = serializers.BooleanField()


class ParsedExpenseSerializer(serializers.ModelSerializer):
    expense_id = serializers.SerializerMethodField()

    class Meta:
        model = ParsedExpense
        fields = [
            'id', 'gmail_message_id', 'subject', 'sender', 'merchant',
            'amount', 'currency', 'transaction_date', 'payment_method',
            'order_id', 'category', 'description', 'confidence',
            'parse_method', 'status', 'expense_id', 'created_at',
        ]
        read_only_fields = fields

    def get_expense_id(self, obj):
        return obj.expense_id


class ParsedExpenseUpdateSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=50, required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    description = serializers.CharField(max_length=500, required=False)
    merchant = serializers.CharField(max_length=200, required=False)


class EmailSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailSyncLog
        fields = [
            'id', 'started_at', 'finished_at', 'status',
            'emails_scanned', 'expenses_parsed', 'expenses_imported', 'error_message',
        ]
