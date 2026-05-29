from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Expense, Goal, ChatMessage, AIInsight, CategorizationLog, Profile, Notification


# ─── User ─────────────────────────────────────────────────────────
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'date_joined']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    password = serializers.CharField(min_length=6, write_only=True)
    email    = serializers.EmailField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        # Run Django's built-in password validators
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjValidationError
        try:
            validate_password(value)
        except DjValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
        )
        Profile.objects.create(user=user)
        return user


# ─── Profile / Budget ─────────────────────────────────────────────
class ProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model  = Profile
        fields = ['monthly_budget', 'gmail_address']

    def validate_monthly_budget(self, value):
        if value <= 0:
            raise serializers.ValidationError('Monthly budget must be greater than zero.')
        if value > 100_000_000:
            raise serializers.ValidationError('Monthly budget is too large.')
        return value


# ─── Expense ──────────────────────────────────────────────────────
class ExpenseSerializer(serializers.ModelSerializer):
    ai_suggestion = serializers.SerializerMethodField()

    class Meta:
        model  = Expense
        fields = [
            'id', 'amount', 'category', 'description',
            'is_essential', 'date', 'updated_at',
            'ai_category', 'ai_suggestion',
        ]
        read_only_fields = ['user', 'date', 'updated_at', 'ai_category']

    def get_ai_suggestion(self, obj):
        """Return AI categorization log if exists."""
        try:
            log = obj.categorization_log
            return {
                'suggested_category': log.suggested_category,
                'confidence':         round(log.confidence, 2),
                'accepted':           log.accepted,
            }
        except Exception:
            return None


# ─── Goal ─────────────────────────────────────────────────────────
class GoalSerializer(serializers.ModelSerializer):
    progress             = serializers.SerializerMethodField()
    remaining_amount     = serializers.SerializerMethodField()
    days_remaining       = serializers.SerializerMethodField()

    class Meta:
        model  = Goal
        fields = [
            'id', 'title', 'category',
            'target_amount', 'saved_amount', 'deadline',
            'created_at', 'progress', 'remaining_amount', 'days_remaining',
            'predicted_completion_date', 'on_track', 'monthly_required',
        ]
        read_only_fields = [
            'user', 'created_at',
            'predicted_completion_date', 'on_track', 'monthly_required',
        ]

    def get_progress(self, obj):
        return obj.progress_percentage()

    def get_remaining_amount(self, obj):
        return obj.remaining_amount()

    def get_days_remaining(self, obj):
        from django.utils import timezone
        today = timezone.now().date()
        return (obj.deadline - today).days


# ─── Chat ─────────────────────────────────────────────────────────
class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ChatMessage
        fields = ['id', 'role', 'content', 'session_id', 'created_at', 'model_used']
        read_only_fields = ['user', 'created_at', 'model_used']


class ChatRequestSerializer(serializers.Serializer):
    question   = serializers.CharField(max_length=2000)
    session_id = serializers.CharField(max_length=100, default='default')


# ─── Insights ─────────────────────────────────────────────────────
class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AIInsight
        fields = ['id', 'type', 'title', 'message', 'data', 'is_read', 'created_at']
        read_only_fields = ['user', 'created_at']


# ─── Notifications ────────────────────────────────────────────────
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'type',
            'priority',
            'is_read',
            'data',
            'created_at',
        ]
        read_only_fields = fields


# ─── Categorization ───────────────────────────────────────────────
class CategorizationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CategorizationLog
        fields = ['id', 'original_text', 'suggested_category', 'confidence', 'accepted', 'created_at']
        read_only_fields = ['__all__']


class CategorizeRequestSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=500)
    amount      = serializers.FloatField(min_value=0)


# ─── Goal Prediction ──────────────────────────────────────────────
class GoalPredictionSerializer(serializers.Serializer):
    on_track           = serializers.BooleanField()
    predicted_date     = serializers.CharField(allow_null=True)
    monthly_required   = serializers.FloatField(allow_null=True)
    confidence         = serializers.FloatField()
    advice             = serializers.CharField()


# ─── Chrome Extension ─────────────────────────────────────────────
class PurchaseAnalyzeSerializer(serializers.Serializer):
    title    = serializers.CharField(max_length=300, required=False, allow_blank=True)
    price    = serializers.FloatField(min_value=0, required=False, default=0)
    category = serializers.CharField(max_length=80, required=False, allow_blank=True)
    url      = serializers.CharField(max_length=500, required=False, allow_blank=True)
    image    = serializers.CharField(max_length=500, required=False, allow_blank=True)
    site     = serializers.CharField(max_length=32, required=False, allow_blank=True)


class QuickExpenseSerializer(serializers.Serializer):
    description  = serializers.CharField(max_length=500)
    amount       = serializers.FloatField(min_value=0.01)
    category     = serializers.CharField(max_length=50, required=False, default='shopping')
    is_essential = serializers.BooleanField(required=False, default=False)