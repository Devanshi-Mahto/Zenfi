"""
Django settings for zenfi project.
"""

from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-n7vjqkcilep-3e+6a7$)i8cp-3l%2g$$ro5n#&gkw2d^$fj=m3')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['*']

# ─── API Keys ────────────────────────────────────────────────────
GEMINI_API_KEY  = os.getenv('GEMINI_API_KEY', '')
OPENAI_API_KEY  = os.getenv('OPENAI_API_KEY', '')

# ─── Gmail OAuth ──────────────────────────────────────────────────

GMAIL_CLIENT_ID     = os.getenv('GMAIL_CLIENT_ID', '')
GMAIL_CLIENT_SECRET = os.getenv('GMAIL_CLIENT_SECRET', '')
GMAIL_REDIRECT_URI  = os.getenv(
    'GMAIL_REDIRECT_URI', 'http://localhost:8000/api/gmail/callback/',
)
GMAIL_TOKEN_ENCRYPTION_KEY = os.getenv('GMAIL_TOKEN_ENCRYPTION_KEY', '')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# ─── Installed Apps ───────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local
    'core',
    'gmail_integration',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',          # ← must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'zenfi.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'zenfi.wsgi.application'

# ─── Database ─────────────────────────────────────────────────────
if os.getenv('POSTGRES_DB'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME':     os.getenv('POSTGRES_DB', 'zenfi'),
            'USER':     os.getenv('POSTGRES_USER', 'zenfi'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', ''),
            'HOST':     os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT':     os.getenv('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ─── Auth / JWT ───────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'core.utils.custom_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── CORS ─────────────────────────────────────────────────────────
# CORS_ALLOWED_ORIGINS = [
#     'http://localhost:5173',
#     'http://127.0.0.1:5173',
#     'http://localhost:3000',
# ]
# CORS_ALLOW_CREDENTIALS = True

# ─── CORS ─────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',

    'http://localhost:5174',
    'http://127.0.0.1:5174',

    'http://localhost:3000',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',

    'http://localhost:5174',
    'http://127.0.0.1:5174',

    'http://localhost:3000',
]

CORS_ALLOW_CREDENTIALS = True

# Chrome extension (Manifest V3)
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^chrome-extension://[a-z]{32}$',
]

# ─── Celery ───────────────────────────────────────────────────────
CELERY_BROKER_URL         = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_CACHE_BACKEND      = 'default'
CELERY_ACCEPT_CONTENT     = ['json']
CELERY_TASK_SERIALIZER    = 'json'
CELERY_RESULT_SERIALIZER  = 'json'
CELERY_TIMEZONE           = 'Asia/Kolkata'
CELERY_BEAT_SCHEDULE = {
    'gmail-sync-every-15-minutes': {
        'task': 'gmail_integration.tasks.sync_tasks.sync_all_connected_gmail_accounts',
        'schedule': 900.0,  # 15 minutes
    },
    'zenfi-financial-checks-every-6-hours': {
        'task': 'core.tasks.scheduled_financial_checks',
        'schedule': 21600.0,  # 6 hours
    },
}

# ─── Cache ────────────────────────────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# ─── i18n ─────────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'Asia/Kolkata'
USE_I18N      = True
USE_TZ        = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'