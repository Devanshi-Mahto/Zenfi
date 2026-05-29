
from django.db import models
from django.contrib.auth.models import User
# ─── User Profile ───────────────────────────────────────────────
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    monthly_budget = models.DecimalField(max_digits=10, decimal_places=2, default=30000)
    gmail_auto_sync = models.BooleanField(
        default=True,
        help_text='Automatically import expenses from Gmail receipts',
    )
    gmail_address = models.EmailField(
        blank=True,
        null=True,
        help_text='The Gmail address connected for auto-sync',
    )

    def __str__(self):
        return f"Profile: {self.user.username}"


# ─── Expense ──────────────────────────────────────────────────────
class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('food',          'Food & Dining'),
        ('shopping',      'Shopping'),
        ('travel',        'Travel & Transport'),
        ('bills',         'Bills & Utilities'),
        ('entertainment', 'Entertainment'),
        ('health',        'Health & Medical'),
        ('education',     'Education'),
        ('investment',    'Investment'),
        ('other',         'Other'),
    ]

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses')
    amount       = models.DecimalField(max_digits=10, decimal_places=2)
    category     = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    description  = models.TextField(blank=True)
    is_essential = models.BooleanField(default=False)
    date         = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    # AI-enhanced field
    ai_category  = models.CharField(max_length=50, blank=True, null=True,
                                    help_text='AI-suggested category override')
    source = models.CharField(
        max_length=20,
        default='manual',
        choices=[('manual', 'Manual'), ('gmail', 'Gmail'), ('extension', 'Extension')],
    )
    gmail_message_id = models.CharField(max_length=128, blank=True, db_index=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.category} - ₹{self.amount} ({self.user.username})"


# ─── Goal ─────────────────────────────────────────────────────────
class Goal(models.Model):
    CATEGORY_CHOICES = [
        ('savings',    'Savings'),
        ('travel',     'Travel'),
        ('tech',       'Tech'),
        ('vehicle',    'Vehicle'),
        ('education',  'Education'),
        ('investment', 'Investment'),
        ('health',     'Health'),
        ('home',       'Home'),
        ('other',      'Other'),
    ]

    user          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='goals')
    title         = models.CharField(max_length=255)
    category      = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='savings')
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    saved_amount  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deadline      = models.DateField()
    created_at    = models.DateTimeField(auto_now_add=True)

    # AI prediction fields
    predicted_completion_date = models.DateField(null=True, blank=True)
    on_track                  = models.BooleanField(null=True, blank=True)
    monthly_required          = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def progress_percentage(self):
        if self.target_amount == 0:
            return 0
        return round(float(self.saved_amount) / float(self.target_amount) * 100, 1)

    def remaining_amount(self):
        return max(float(self.target_amount) - float(self.saved_amount), 0)

    def __str__(self):
        return f"{self.title} ({self.user.username})"


# ─── ChatMessage ──────────────────────────────────────────────────
class ChatMessage(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_messages')
    session_id = models.CharField(max_length=100, default='default',
                                  help_text='Groups messages into conversations')
    role       = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    # Optional metadata
    tokens_used = models.IntegerField(null=True, blank=True)
    model_used  = models.CharField(max_length=50, default='gemini-1.5-flash')

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.user.username}: {self.content[:60]}"


# ─── AIInsight ────────────────────────────────────────────────────
class AIInsight(models.Model):
    TYPE_CHOICES = [
        ('overspending',  'Overspending Alert'),
        ('savings_tip',   'Savings Suggestion'),
        ('goal_warning',  'Goal Delay Warning'),
        ('pattern',       'Spending Pattern'),
        ('general',       'General Insight'),
    ]

    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='insights')
    type       = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=255)
    message    = models.TextField()
    data       = models.JSONField(default=dict, blank=True,
                                  help_text='Structured data backing this insight')
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.type}] {self.title} – {self.user.username}"


# ─── Notifications ─────────────────────────────────────────────────
class Notification(models.Model):
    """
    User-facing alert feed.
    Designed to support future push/websocket delivery.
    """
    TYPE_CHOICES = [
        ('budget', 'Budget alert'),
        ('overspending', 'Overspending warning'),
        ('goal', 'Savings goal'),
        ('ai', 'AI insight'),
        ('gmail', 'Gmail expense'),
        ('extension', 'Purchase assistant'),
        ('reminder', 'Reminder'),
        ('unusual', 'Unusual activity'),
        ('info', 'Info'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='info')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    is_read = models.BooleanField(default=False)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', 'created_at']),
            models.Index(fields=['user', 'type', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.type}] {self.title} ({self.user.username})"


# ─── TransactionCategorizationLog ────────────────────────────────
class CategorizationLog(models.Model):
    """Tracks AI auto-categorization requests and results."""
    expense          = models.OneToOneField(Expense, on_delete=models.CASCADE,
                                            related_name='categorization_log')
    original_text    = models.TextField()
    suggested_category = models.CharField(max_length=50)
    confidence       = models.FloatField(default=0.0)
    accepted         = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.original_text[:50]} → {self.suggested_category}"