import json

import requests
from django.core.cache import cache
from django.http import HttpResponse
from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import ApartmentFilter, EducationFilter, SafetyFilter
from .models import (
    Apartment,
    District,
    EducationFacility,
    SafetyData,
)
from .serializers import (
    ApartmentSerializer,
    EducationFacilitySerializer,
    SafetyDataSerializer,
)


GEOGDANSK_NOISE_URL = (
    "https://geogdansk.pl/server/services/Srodowisko/Mapa_halasu/MapServer/WMSServer"
)
NOISE_CACHE_TTL = 60 * 60 * 24

@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})

class SafetyListView(generics.ListAPIView):
    queryset = SafetyData.objects.select_related("district").all()
    serializer_class = SafetyDataSerializer
    permission_classes = [AllowAny]
    filterset_class = SafetyFilter
    pagination_class = None


class EducationListView(generics.ListAPIView):
    queryset = EducationFacility.objects.select_related("district").all()
    serializer_class = EducationFacilitySerializer
    permission_classes = [AllowAny]
    filterset_class = EducationFilter
    pagination_class = None


class DistrictGeoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        features = []
        for d in District.objects.all():
            features.append({
                "type": "Feature",
                "geometry": json.loads(d.geometry.geojson),
                "properties": {
                    "id": d.id,
                    "name": d.name,
                    "name_de": d.name_de,
                },
            })
        return Response({
            "type": "FeatureCollection",
            "features": features,
        })


class ApartmentListView(generics.ListAPIView):
    serializer_class = ApartmentSerializer
    permission_classes = [AllowAny]
    filterset_class = ApartmentFilter
    pagination_class = None

    def get_queryset(self):
        qs = Apartment.objects.select_related("district").all()

        params = self.request.query_params
        if "is_active" not in params:
            qs = qs.filter(is_active=True)
        if "validation_status" not in params:
            qs = qs.filter(validation_status="valid")

        return qs


@api_view(["GET"])
@permission_classes([AllowAny])
def get_noise_data(request):
    query_params = request.GET.urlencode()
    cache_key = f"noise_tile_{query_params}"
    cached_tile = cache.get(cache_key)

    if cached_tile:
        return HttpResponse(
            cached_tile["content"],
            content_type=cached_tile["content_type"],
        )

    try:
        resp = requests.get(
            f"{GEOGDANSK_NOISE_URL}?{query_params}",
            timeout=10,
        )
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/png")

        cache.set(
            cache_key,
            {"content": resp.content, "content_type": content_type},
            timeout=NOISE_CACHE_TTL,
        )

        return HttpResponse(resp.content, content_type=content_type)

    except Exception as e:
        return Response(
            {"error": "Blad pobierania warstwy halasu", "details": str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )