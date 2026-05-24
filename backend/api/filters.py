import django_filters

from .models import Apartment, EducationFacility, SafetyData


class ApartmentFilter(django_filters.FilterSet):
    price_min = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    district = django_filters.CharFilter(
        field_name="district__name", lookup_expr="iexact"
    )

    class Meta:
        model = Apartment
        fields = ["rooms", "offer_type", "validation_status", "is_active"]


class EducationFilter(django_filters.FilterSet):
    district = django_filters.CharFilter(
        field_name="district__name", lookup_expr="iexact"
    )

    class Meta:
        model = EducationFacility
        fields = ["facility_type"]


class SafetyFilter(django_filters.FilterSet):
    class Meta:
        model = SafetyData
        fields = ["year"]