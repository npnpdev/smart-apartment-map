from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MeView

urlpatterns = [
    path("login/", TokenObtainPairView.as_view(), name="jwt_login"),
    path("refresh/", TokenRefreshView.as_view(), name="jwt_refresh"),
    path("me/", MeView.as_view(), name="me"),
]