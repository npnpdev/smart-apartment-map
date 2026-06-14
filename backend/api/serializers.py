import json

from rest_framework import serializers

from .models import (
    Apartment,
    District,
    EducationFacility,
    FavoriteApartment,
    SafetyData,
)


EDU_TYPE_LABELS = {
    "kindergarten": "Przedszkola",
    "primary": "Podstawowe",
    "secondary": "Średnie",
    "university": "Uczelnie",
    "other": "Inne",
}


class SafetyDataSerializer(serializers.ModelSerializer):
    # zachowanie kontraktu z aktualnym frontendem
    dzielnica = serializers.CharField(source="district.name", read_only=True)
    wskaznik_przestepstw = serializers.DecimalField(
        source="crimes_per_1000",
        max_digits=8,
        decimal_places=3,
        read_only=True,
    )

    class Meta:
        model = SafetyData
        fields = [
            "dzielnica",
            "wskaznik_przestepstw",
            "year",
            "population",
            "crimes_total",
        ]


class ApartmentSerializer(serializers.ModelSerializer):
    # Legacy keys
    name = serializers.CharField(source="title", read_only=True)
    district = serializers.CharField(
        source="district.name", read_only=True, allow_null=True
    )
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    noise_db = serializers.IntegerField(
        source="noise_db_max", read_only=True, allow_null=True
    )

    # Nowe pola
    price_per_m2 = serializers.ReadOnlyField()

    class Meta:
        model = Apartment
        fields = [
            "id",
            # legacy
            "name",
            "district",
            "lat",
            "lng",
            "price",
            "noise_db",
            # nowe
            "title",
            "area",
            "rooms",
            "offer_type",
            "noise_db_min",
            "noise_db_max",
            "price_per_m2",
            "is_active",
            "validation_status",
            "source_url",
        ]

    def get_lat(self, obj):
        return obj.location.y if obj.location else None

    def get_lng(self, obj):
        return obj.location.x if obj.location else None


class EducationFacilitySerializer(serializers.ModelSerializer):
    # Legacy keys
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    amenity = serializers.CharField(source="raw_amenity", read_only=True)
    school = serializers.CharField(source="raw_school_tag", read_only=True)
    education_type = serializers.SerializerMethodField()

    class Meta:
        model = EducationFacility
        fields = [
            "id",
            "name",
            # legacy
            "lat",
            "lng",
            "amenity",
            "school",
            "education_type",
            # nowe (znormalizowane)
            "facility_type",
        ]

    def get_lat(self, obj):
        return obj.location.y if obj.location else None

    def get_lng(self, obj):
        return obj.location.x if obj.location else None

    def get_education_type(self, obj):
        return EDU_TYPE_LABELS.get(obj.facility_type, "Inne")

    def to_representation(self, instance):
        # Frontend moze oczekiwac klucza 'isced:level'. Dorzucamy recznie.
        data = super().to_representation(instance)
        data["isced:level"] = instance.raw_isced
        return data





class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ["id", "name", "name_de"]