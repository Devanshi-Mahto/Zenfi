"""
Gmail integration REST API.
"""
import logging
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from ..models import GmailAccount, ParsedExpense, EmailSyncLog
from ..services.oauth import build_auth_url, exchange_code_for_tokens, disconnect_gmail
from ..services.sync import sync_user_gmail, approve_parsed_expense, reject_parsed_expense
from ..tasks.sync_tasks import sync_gmail_for_user
from core.models import Profile as CoreProfile
from .serializers import (
    ParsedExpenseSerializer,
    ParsedExpenseUpdateSerializer,
    EmailSyncLogSerializer,
)

logger = logging.getLogger(__name__)


def _gmail_status(user) -> dict:
    from django.conf import settings as django_settings

    configured = bool(django_settings.GMAIL_CLIENT_ID and django_settings.GMAIL_CLIENT_SECRET)
    try:
        account = GmailAccount.objects.get(user=user)
        has_token = False
        try:
            has_token = bool(account.token.access_token_encrypted)
        except Exception:
            pass

        profile, _ = CoreProfile.objects.get_or_create(user=user)
        return {
            'connected': account.is_connected and has_token,
            'email': account.email,
            'last_sync_at': account.last_sync_at,
            'sync_enabled': account.sync_enabled,
            'gmail_auto_sync': profile.gmail_auto_sync,
            'api_configured': configured,
        }
    except GmailAccount.DoesNotExist:
        profile, _ = CoreProfile.objects.get_or_create(user=user)
        return {
            'connected': False,
            'email': '',
            'last_sync_at': None,
            'sync_enabled': False,
            'gmail_auto_sync': profile.gmail_auto_sync,
            'api_configured': configured,
        }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gmail_status(request):
    return Response(_gmail_status(request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gmail_connect(request):
    """Return Google OAuth URL to start Gmail connection."""
    try:
        auth_url, state = build_auth_url(request.user)
        return Response({'auth_url': auth_url, 'state': state})
    except ValueError as exc:
        return Response({'error': True, 'detail': str(exc)}, status=503)


@api_view(['GET'])
@permission_classes([AllowAny])
def gmail_callback(request):
    """
    OAuth redirect handler. Google redirects here with ?code=&state=
    Redirects user back to frontend settings.
    """
    code = request.GET.get('code')
    state = request.GET.get('state')
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

    if not code or not state:
        return HttpResponseRedirect(f'{frontend}/settings?gmail=error&reason=missing_params')

    from ..models import GmailOAuthState
    try:
        oauth_state = GmailOAuthState.objects.select_related('user').get(state=state)
        user = oauth_state.user
    except GmailOAuthState.DoesNotExist:
        return HttpResponseRedirect(f'{frontend}/settings?gmail=error&reason=invalid_state')

    try:
        exchange_code_for_tokens(user, code, state)
        return HttpResponseRedirect(f'{frontend}/settings?gmail=connected')
    except Exception as exc:
        logger.exception('Gmail OAuth callback failed')
        return HttpResponseRedirect(
            f'{frontend}/settings?gmail=error&reason={str(exc)[:80]}'
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gmail_disconnect(request):
    disconnect_gmail(request.user)
    return Response({'message': 'Gmail disconnected'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gmail_reconnect(request):
    """
    Disconnect the current Gmail account (if any) and return a fresh OAuth URL.
    Used for a "Change Gmail" button in the frontend.
    """
    from django.conf import settings as django_settings

    if not django_settings.GMAIL_CLIENT_ID or not django_settings.GMAIL_CLIENT_SECRET:
        return Response(
            {
                'status': 'error',
                'message': (
                    'Gmail API credentials missing on server. '
                    'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in zenfi/.env and restart Django.'
                ),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    disconnect_gmail(request.user)
    auth_url, state = build_auth_url(request.user)
    return Response({'auth_url': auth_url, 'state': state})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def gmail_settings(request):
    """
    Update Gmail sync preferences for the user:
    - sync_enabled (GmailAccount.sync_enabled)
    - gmail_auto_sync (Profile.gmail_auto_sync)
    """
    account = GmailAccount.objects.filter(user=request.user).first()
    if not account:
        return Response({'error': 'Gmail not connected'}, status=status.HTTP_404_NOT_FOUND)

    profile, _ = CoreProfile.objects.get_or_create(user=request.user)

    if 'sync_enabled' in request.data:
        account.sync_enabled = bool(request.data.get('sync_enabled'))
        account.save(update_fields=['sync_enabled'])

    if 'gmail_auto_sync' in request.data:
        profile.gmail_auto_sync = bool(request.data.get('gmail_auto_sync'))
        profile.save(update_fields=['gmail_auto_sync'])

    return Response({
        'sync_enabled': account.sync_enabled,
        'gmail_auto_sync': profile.gmail_auto_sync,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gmail_sync(request):
    """Trigger Gmail sync (runs immediately by default; optional Celery)."""
    from django.conf import settings as django_settings

    if not django_settings.GMAIL_CLIENT_ID or not django_settings.GMAIL_CLIENT_SECRET:
        return Response(
            {
                'status': 'error',
                'message': (
                    'Gmail API credentials missing on server. '
                    'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in zenfi/.env, then restart Django.'
                ),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    async_mode = request.data.get('async', False)
    if async_mode in (True, 'true', '1', 1):
        try:
            task = sync_gmail_for_user.delay(request.user.pk)
            return Response({
                'status': 'accepted',
                'message': 'Gmail sync started in background',
                'task_id': str(task.id),
            }, status=status.HTTP_202_ACCEPTED)
        except Exception as exc:
            logger.warning('Celery unavailable, falling back to sync: %s', exc)

    result = sync_user_gmail(request.user)
    http_status = status.HTTP_200_OK if result.get('status') != 'error' else status.HTTP_400_BAD_REQUEST
    return Response(result, status=http_status)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def parsed_expenses_list(request):
    """List parsed expenses (pending by default)."""
    qs = ParsedExpense.objects.filter(user=request.user)
    status_filter = request.query_params.get('status')
    if status_filter:
        qs = qs.filter(status=status_filter)
    else:
        qs = qs.filter(status='pending')

    serializer = ParsedExpenseSerializer(qs[:50], many=True)
    return Response({'count': qs.count(), 'results': serializer.data})


@api_view(['GET', 'PATCH', 'POST'])
@permission_classes([IsAuthenticated])
def parsed_expense_detail(request, pk):
    try:
        parsed = ParsedExpense.objects.get(pk=pk, user=request.user)
    except ParsedExpense.DoesNotExist:
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ParsedExpenseSerializer(parsed).data)

    if request.method == 'POST':
        action = request.data.get('action', 'approve')
        if action == 'reject':
            reject_parsed_expense(parsed)
            return Response({'status': 'rejected'})
        ser = ParsedExpenseUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        expense = approve_parsed_expense(
            parsed,
            category=ser.validated_data.get('category'),
            amount=ser.validated_data.get('amount'),
            description=ser.validated_data.get('description'),
        )
        return Response({
            'status': 'imported',
            'expense_id': expense.pk,
            'parsed': ParsedExpenseSerializer(parsed).data,
        })

    if request.method == 'PATCH':
        ser = ParsedExpenseUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for field, value in ser.validated_data.items():
            setattr(parsed, field, value)
        parsed.save()
        return Response(ParsedExpenseSerializer(parsed).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sync_logs(request):
    logs = EmailSyncLog.objects.filter(user=request.user)[:10]
    return Response(EmailSyncLogSerializer(logs, many=True).data)
