from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MeView, PasswordResetConfirmView, PasswordResetRequestView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="jwt_login"),
    path("refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
]