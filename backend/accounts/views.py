from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from django.contrib.auth import get_user_model

from .emails import send_password_reset_email
from .serializers import (
    DeleteAccountSerializer,
    MeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data) #zwraca dane uzytkownika JSON

    def delete(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save() #wywoluje create 

        # od razu generujemy JWT
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": MeSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(email=serializer.validated_data["email"], is_active=True).first()
        if user is not None:
            send_password_reset_email(user)

        return Response({"detail": "Jeśli konto o tym adresie istnieje, wysłaliśmy link do resetu hasła."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        user.save()

        return Response({"detail": "Hasło zostało zmienione."})
