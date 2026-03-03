from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MeView, RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="jwt_login"),
    path("refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("me/", MeView.as_view(), name="me"),
]