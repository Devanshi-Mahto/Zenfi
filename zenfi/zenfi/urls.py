from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth
    path('api/login/',   TokenObtainPairView.as_view(),  name='token_obtain'),
    path('api/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),

    # Core app routes
    path('api/', include('core.urls')),
    path('api/gmail/', include('gmail_integration.api.urls')),
]
