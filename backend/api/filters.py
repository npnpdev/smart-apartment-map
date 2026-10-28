import unicodedata

import django_filters
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Exists, F, OuterRef, Q, Subquery
from rest_framework.serializers import ValidationError

from .models import Apartment, EducationFacility, SafetyData
from .serializers import EDU_TYPE_LABELS


DEFAULT_RADIUS_KM = 5


def latest_crimes_per_1000(district_ref):
    """Podzapytanie: wskaźnik przestępstw z najnowszego roku statystyk dzielnicy."""
    return (
        SafetyData.objects.filter(district=district_ref)
        .order_by("-year")
        .values("crimes_per_1000")[:1]
    )


def simplify_text(text):
    """Małe litery bez polskich znaków, np. 'Średnie' -> 'srednie'."""
    decomposed = unicodedata.normalize("NFKD", (text or "").strip().lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


# Przyjmujemy zarówno etykiety z UI ('Przedszkola'), jak i klucze modelu ('kindergarten')
EDU_TYPE_ALIASES = {simplify_text(label): key for key, label in EDU_TYPE_LABELS.items()}
EDU_TYPE_ALIASES.update(
    {simplify_text(key): key for key, _ in EducationFacility.TYPE_CHOICES}
)


def split_csv(value):
    """'a, b,,c' -> ['a', 'b', 'c']"""
    return [part.strip() for part in (value or "").split(",") if part.strip()]


def parse_edu_types(value):
    types = []
    for part in split_csv(value):
        key = EDU_TYPE_ALIASES.get(simplify_text(part))
        if key is None:
            raise ValidationError(
                f"Nieznany typ placowki: {part}. "
                f"Dozwolone: {', '.join(sorted(EDU_TYPE_LABELS.values()))}."
            )
        if key not in types:
            types.append(key)
    return types


def parse_choices(value, allowed, param_name):
    """'a,b' -> ['a', 'b']; nieznana wartość = 400 z listą dozwolonych."""
    selected = []
    for part in split_csv(value):
        if part not in allowed:
            raise ValidationError(
                f"Nieznana wartość '{part}' dla {param_name}. "
                f"Dozwolone: {', '.join(allowed)}."
            )
        if part not in selected:
            selected.append(part)
    return selected


def any_of(conditions):
    """OR z listy warunków Q (jeden przycisk w UI = jeden warunek)."""
    combined = Q()
    for condition in conditions:
        combined |= condition
    return combined


def parse_radius_km(raw):
    """Promień z parametru zapytania; brak, błędna lub niedodatnia wartość -> domyślny."""
    if raw in (None, ""):
        return DEFAULT_RADIUS_KM
    try:
        radius = float(raw)
    except (TypeError, ValueError):
        return DEFAULT_RADIUS_KM
    return radius if radius > 0 else DEFAULT_RADIUS_KM


def parse_point(value):
    """'lat,lng' -> Point albo None, gdy wartość jest niepoprawna."""
    try:
        lat, lng = (float(x) for x in value.split(","))
    except (AttributeError, TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return Point(lng, lat, srid=4326)


# Przyciski z panelu filtrów -> warunki w bazie
ROOM_CHOICES = {
    "1": Q(rooms=1),
    "2": Q(rooms=2),
    "3": Q(rooms=3),
    "4+": Q(rooms__gte=4),
}

FLOOR_CHOICES = {
    "ground": Q(floor=0),
    "1-3": Q(floor__gte=1, floor__lte=3),
    "4+": Q(floor__gte=4),
}

YEAR_BUILT_CHOICES = {
    "pre1945": Q(year_built__lt=1945),
    "1945-2000": Q(year_built__gte=1945, year_built__lt=2000),
    "2000-2015": Q(year_built__gte=2000, year_built__lte=2015),
    "post2015": Q(year_built__gt=2015),
}


class ApartmentFilter(django_filters.FilterSet):
    price_min = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    area_min = django_filters.NumberFilter(field_name="area", lookup_expr="gte")
    area_max = django_filters.NumberFilter(field_name="area", lookup_expr="lte")
    rooms_min = django_filters.NumberFilter(field_name="rooms", lookup_expr="gte")
    rooms_max = django_filters.NumberFilter(field_name="rooms", lookup_expr="lte")
    # wielokrotny wybór z panelu, np. rooms=1,2,4+ / floors=ground,4+ / year_built=post2015
    rooms = django_filters.CharFilter(method="filter_rooms")
    floors = django_filters.CharFilter(method="filter_floors")
    year_built = django_filters.CharFilter(method="filter_year_built")
    has_elevator = django_filters.BooleanFilter(field_name="has_elevator")
    price_per_m2_min = django_filters.NumberFilter(method="filter_price_per_m2_min")
    price_per_m2_max = django_filters.NumberFilter(method="filter_price_per_m2_max")
    # brak danych o hałasie/bezpieczeństwie = nie odrzucamy (tak samo jak na froncie)
    noise_max = django_filters.NumberFilter(method="filter_noise_max")
    safety_max = django_filters.NumberFilter(method="filter_safety_max")
    district = django_filters.CharFilter(
        field_name="district__name", lookup_expr="iexact"
    )
    # kilka dzielnic naraz, np. districts=Oliwa,Wrzeszcz Górny
    districts = django_filters.CharFilter(method="filter_districts")
    near = django_filters.CharFilter(method="filter_near")
    radius_km = django_filters.NumberFilter(method="filter_noop")
    edu_types = django_filters.CharFilter(method="filter_edu_types")
    edu_radius = django_filters.NumberFilter(method="filter_noop")

    class Meta:
        model = Apartment
        fields = ["offer_type", "validation_status", "is_active"]

    def filter_noop(self, queryset, name, value):
        # radius_km / edu_radius odczytują filter_near / filter_edu_types
        return queryset

    def filter_by_choices(self, queryset, value, choices, param_name):
        selected = parse_choices(value, list(choices), param_name)
        if not selected:
            return queryset
        return queryset.filter(any_of(choices[choice] for choice in selected))

    def filter_rooms(self, queryset, name, value):
        # zgodność wstecz: rooms=2 (pojedyncza liczba) nadal działa
        return self.filter_by_choices(queryset, value, ROOM_CHOICES, "rooms")

    def filter_floors(self, queryset, name, value):
        return self.filter_by_choices(queryset, value, FLOOR_CHOICES, "floors")

    def filter_year_built(self, queryset, name, value):
        # oferty bez roku budowy odpadają - nie wiadomo, czy pasują
        return self.filter_by_choices(queryset, value, YEAR_BUILT_CHOICES, "year_built")

    def with_price_per_m2(self, queryset):
        if "price_per_m2_value" in queryset.query.annotations:
            return queryset
        return queryset.filter(area__gt=0).annotate(
            price_per_m2_value=F("price") / F("area")
        )

    def filter_price_per_m2_min(self, queryset, name, value):
        return self.with_price_per_m2(queryset).filter(price_per_m2_value__gte=value)

    def filter_price_per_m2_max(self, queryset, name, value):
        return self.with_price_per_m2(queryset).filter(price_per_m2_value__lte=value)

    def filter_districts(self, queryset, name, value):
        names = split_csv(value)
        if not names:
            return queryset
        return queryset.filter(any_of(Q(district__name__iexact=n) for n in names))

    def filter_noise_max(self, queryset, name, value):
        return queryset.filter(
            Q(noise_db_max__isnull=True) | Q(noise_db_max__lte=value)
        )

    def filter_safety_max(self, queryset, name, value):
        # najnowszy rok statystyk dla dzielnicy
        queryset = queryset.annotate(
            crimes_per_1000=Subquery(latest_crimes_per_1000(OuterRef("district")))
        )
        return queryset.filter(
            Q(crimes_per_1000__isnull=True) | Q(crimes_per_1000__lte=value)
        )

    def filter_near(self, queryset, name, value):
        point = parse_point(value)
        if point is None:
            return queryset
        radius = parse_radius_km(self.data.get("radius_km"))
        return queryset.filter(location__dwithin=(point, D(km=radius)))

    def filter_edu_types(self, queryset, name, value):
        types = parse_edu_types(value)
        if not types:
            return queryset
        radius = D(km=parse_radius_km(self.data.get("edu_radius")))
        # mieszkanie musi mieć w promieniu każdy z wybranych typów placówek
        for facility_type in types:
            nearby = EducationFacility.objects.filter(
                facility_type=facility_type,
                location__dwithin=(OuterRef("location"), radius),
            )
            queryset = queryset.filter(Exists(nearby))
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
        # radius_km odczytuje filter_near
        return queryset

    def filter_near(self, queryset, name, value):
        point = parse_point(value)
        if point is None:
            return queryset
        radius = parse_radius_km(self.data.get("radius_km"))
        return queryset.filter(location__dwithin=(point, D(km=radius)))


class SafetyFilter(django_filters.FilterSet):
    class Meta:
        model = SafetyData
        fields = ["year"]
