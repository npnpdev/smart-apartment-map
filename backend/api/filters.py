import unicodedata

import django_filters
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Exists, OuterRef
from rest_framework.serializers import ValidationError

from .models import Apartment, EducationFacility, SafetyData
from .serializers import EDU_TYPE_LABELS


DEFAULT_RADIUS_KM = 5


def uprosc(tekst):
    rozlozony = unicodedata.normalize("NFKD", (tekst or "").strip().lower())
    return "".join(z for z in rozlozony if not unicodedata.combining(z))


EDU_ALIASY = {uprosc(label): key for key, label in EDU_TYPE_LABELS.items()}
EDU_ALIASY.update({uprosc(key): key for key, _ in EducationFacility.TYPE_CHOICES})


def parse_edu_types(value):
    typy = []
    for czesc in (value or "").split(","):
        if not czesc.strip():
            continue
        klucz = EDU_ALIASY.get(uprosc(czesc))
        if klucz is None:
            raise ValidationError(
                f"Nieznany typ placowki: {czesc.strip()}. "
                f"Dozwolone: {', '.join(sorted(EDU_TYPE_LABELS.values()))}."
            )
        if klucz not in typy:
            typy.append(klucz)
    return typy


def parse_point(value):
    try:
        lat, lng = (float(x) for x in value.split(","))
    except (AttributeError, TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return Point(lng, lat, srid=4326)


class ApartmentFilter(django_filters.FilterSet):
    price_min = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    district = django_filters.CharFilter(
        field_name="district__name", lookup_expr="iexact"
    )
    near = django_filters.CharFilter(method="filter_near")
    radius_km = django_filters.NumberFilter(method="filter_noop")
    edu_types = django_filters.CharFilter(method="filter_edu_types")
    edu_radius = django_filters.NumberFilter(method="filter_noop")

    class Meta:
        model = Apartment
        fields = ["rooms", "offer_type", "validation_status", "is_active"]

    def promien(self, nazwa):
        surowy = self.data.get(nazwa)
        if surowy in (None, ""):
            return DEFAULT_RADIUS_KM
        try:
            wartosc = float(surowy)
        except (TypeError, ValueError):
            return DEFAULT_RADIUS_KM
        return wartosc if wartosc > 0 else DEFAULT_RADIUS_KM

    def filter_noop(self, queryset, name, value):
        return queryset

    def filter_near(self, queryset, name, value):
        punkt = parse_point(value)
        if punkt is None:
            return queryset
        return queryset.filter(
            location__dwithin=(punkt, D(km=self.promien("radius_km")))
        )

    def filter_edu_types(self, queryset, name, value):
        typy = parse_edu_types(value)
        if not typy:
            return queryset
        promien = D(km=self.promien("edu_radius"))
        for typ in typy:
            w_zasiegu = EducationFacility.objects.filter(
                facility_type=typ,
                location__dwithin=(OuterRef("location"), promien),
            )
            queryset = queryset.filter(Exists(w_zasiegu))
        return queryset


class EducationFilter(django_filters.FilterSet):
    district = django_filters.CharFilter(
        field_name="district__name", lookup_expr="iexact"
    )
    near = django_filters.CharFilter(method="filter_near")
    radius_km = django_filters.NumberFilter(method="filter_noop")

    class Meta:
        model = EducationFacility
        fields = ["facility_type"]

    def filter_noop(self, queryset, name, value):
        return queryset

    def filter_near(self, queryset, name, value):
        punkt = parse_point(value)
        if punkt is None:
            return queryset
        surowy = self.data.get("radius_km")
        try:
            promien = float(surowy) if surowy not in (None, "") else DEFAULT_RADIUS_KM
        except (TypeError, ValueError):
            promien = DEFAULT_RADIUS_KM
        return queryset.filter(location__dwithin=(punkt, D(km=promien)))


class SafetyFilter(django_filters.FilterSet):
    class Meta:
        model = SafetyData
        fields = ["year"]
