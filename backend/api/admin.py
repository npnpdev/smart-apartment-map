from django.contrib import admin

from .models import (
    Apartment,
    ApartmentHistory,
    DataVersion,
    District,
    EducationFacility,
    FavoriteApartment,
    NoiseZone,
    SafetyData,
)


@admin.register(DataVersion)
class DataVersionAdmin(admin.ModelAdmin):
    list_display = (
        "version_number", "source", "created_at", "finished_at",
        "items_seen", "items_new", "items_updated",
    )
    list_filter = ("source",)
    readonly_fields = ("created_at",)


@admin.register(Apartment)
class ApartmentAdmin(admin.ModelAdmin):
    list_display = (
        "title", "price", "area", "rooms", "district",
        "validation_status", "is_active", "last_updated_in",
    )
    list_filter = (
        "validation_status", "is_active", "offer_type",
        "source_portal", "district",
    )
    search_fields = ("title", "external_id", "address")
    list_select_related = ("district", "last_updated_in")
    raw_id_fields = ("district", "first_seen_in", "last_updated_in")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ApartmentHistory)
class ApartmentHistoryAdmin(admin.ModelAdmin):
    list_display = ("apartment", "version", "price", "area", "rooms", "created_at")
    list_filter = ("version", "validation_status")
    search_fields = ("apartment__title", "apartment__external_id")
    list_select_related = ("apartment", "version")
    raw_id_fields = ("apartment",)


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("name", "name_de", "osm_relation_id")
    search_fields = ("name", "name_de")


@admin.register(NoiseZone)
class NoiseZoneAdmin(admin.ModelAdmin):
    list_display = ("object_id", "min_db", "max_db", "imported_at")
    list_filter = ("min_db", "max_db")


@admin.register(SafetyData)
class SafetyDataAdmin(admin.ModelAdmin):
    list_display = ("district", "year", "crimes_total", "population", "crimes_per_1000")
    list_filter = ("year",)
    search_fields = ("district__name",)
    list_select_related = ("district",)


@admin.register(EducationFacility)
class EducationFacilityAdmin(admin.ModelAdmin):
    list_display = ("name", "facility_type", "district")
    list_filter = ("facility_type", "district")
    search_fields = ("name",)
    list_select_related = ("district",)


@admin.register(FavoriteApartment)
class FavoriteApartmentAdmin(admin.ModelAdmin):
    list_display = ("user", "apartment", "created_at")
    search_fields = ("user__email", "apartment__title")
    list_select_related = ("user", "apartment")
    raw_id_fields = ("user", "apartment")
