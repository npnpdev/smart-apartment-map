from rest_framework.permissions import IsAuthenticated,AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .serializers import MeSerializer, RegisterSerializer
from rest_framework_simplejwt.tokens import RefreshToken

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data) #zwraca dane uzytkownika JSON
    
    
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