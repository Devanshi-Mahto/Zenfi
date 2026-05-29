"""
Gmail auto expense tracking models.
"""
from django.db import models
from django.contrib.auth.models import User


class GmailAccount(models.Model):
    """Per-user Gmail OAuth connection."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='gmail_account')
    email = models.EmailField(blank=True)
    is_connected = models.BooleanField(default=True)
    connected_at = models.DateTimeField(auto_now_add=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    sync_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Gmail account'

    def __str__(self):
        return self.email or f'Gmail ({self.user.username})'


class GmailToken(models.Model):
    """Encrypted OAuth tokens (never store raw passwords)."""
    account = models.OneToOneField(
        GmailAccount, on_delete=models.CASCADE, related_name='token',
    )
    access_token_encrypted = models.TextField()
    refresh_token_encrypted = models.TextField(blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)
    scopes = models.CharField(max_length=255, default='gmail.readonly')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Token for {self.account}'


class EmailSyncLog(models.Model):
    """Audit log for each Gmail sync run."""
    STATUS_CHOICES = [
        ('running', 'Running'),
        ('success', 'Success'),
        ('partial', 'Partial'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gmail_sync_logs')
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')
    emails_scanned = models.IntegerField(default=0)
    expenses_parsed = models.IntegerField(default=0)
    expenses_imported = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f'Sync {self.user.username} @ {self.started_at:%Y-%m-%d %H:%M}'


class ParsedExpense(models.Model):
    """Extracted transaction from email — user review before final import."""
    STATUS_CHOICES = [
        ('pending', 'Pending review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('imported', 'Imported'),
        ('failed', 'Parse failed'),
        ('duplicate', 'Duplicate'),
    ]

    PAYMENT_METHODS = [
        ('unknown', 'Unknown'),
        ('upi', 'UPI'),
        ('card', 'Card'),
        ('netbanking', 'Net Banking'),
        ('wallet', 'Wallet'),
        ('cod', 'Cash on Delivery'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='parsed_expenses')
    gmail_message_id = models.CharField(max_length=128, db_index=True)
    subject = models.CharField(max_length=500, blank=True)
    sender = models.CharField(max_length=255, blank=True)
    merchant = models.CharField(max_length=200, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=8, default='INR')
    transaction_date = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='unknown')
    order_id = models.CharField(max_length=128, blank=True, db_index=True)
    category = models.CharField(max_length=50, default='other')
    description = models.CharField(max_length=500, blank=True)
    confidence = models.FloatField(default=0.0)
    parse_method = models.CharField(max_length=20, default='regex')  # regex | ai | hybrid
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    raw_snippet = models.TextField(blank=True)
    expense = models.ForeignKey(
        'core.Expense',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parsed_expense',
    )
    sync_log = models.ForeignKey(
        EmailSyncLog, on_delete=models.SET_NULL, null=True, blank=True, related_name='parsed_items',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-transaction_date', '-created_at']
        unique_together = [('user', 'gmail_message_id')]
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'order_id']),
        ]

    def __str__(self):
        return f'{self.merchant or "Unknown"} ₹{self.amount or 0} ({self.status})'


class GmailOAuthState(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gmail_oauth_states')
    state = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
