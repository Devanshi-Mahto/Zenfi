"""
Custom utility functions for ZenFi.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Wraps DRF's default exception handler to always return
    a consistent { error, detail, status_code } JSON structure.
    """
    response = exception_handler(exc, context)

    if response is not None:
        data = {
            'error':       True,
            'status_code': response.status_code,
            'detail':      response.data,
        }
        response.data = data
    else:
        # Unhandled exception → 500
        logger.exception("Unhandled exception in view: %s", exc)
        return Response(
            {
                'error':       True,
                'status_code': 500,
                'detail':      'An internal server error occurred. Please try again.',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response


def format_currency(amount) -> str:
    """Format a decimal/float as an Indian rupee string."""
    return f"₹{float(amount):,.2f}"


def get_monthly_total(user, year=None, month=None) -> float:
    """Get total spending for a user in a given month."""
    from .models import Expense
    from django.utils import timezone
    now = timezone.now()
    year  = year  or now.year
    month = month or now.month
    expenses = Expense.objects.filter(
        user=user, date__year=year, date__month=month
    )
    return float(sum(e.amount for e in expenses))


def get_monthly_budget(user) -> float:
    """Return the user's configured monthly budget (creates profile if missing)."""
    from .models import Profile
    profile, _ = Profile.objects.get_or_create(user=user)
    return float(profile.monthly_budget)
