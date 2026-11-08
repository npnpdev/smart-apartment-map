from django.contrib.gis.db.models import PointField
from django.db.models import OuterRef, Subquery
from django.db.models.functions import Cast

from api.models import District, NoiseZone


def as_geometry(field):
    return Cast(field, PointField(srid=4326))


def containing_district():
    return Subquery(
        District.objects.filter(geometry__contains=as_geometry(OuterRef("location")))
        .order_by("name", "pk")
        .values("id")[:1]
    )


def assign_noise(queryset):
    queryset.update(noise_db_min=None, noise_db_max=None)
    located = queryset.annotate(point=as_geometry("location"))
    for zone in NoiseZone.objects.order_by("-min_db", "-pk").only("min_db", "max_db"):
        zone_geometry = NoiseZone.objects.filter(pk=zone.pk).values("geometry")
        located.filter(point__within=Subquery(zone_geometry)).update(
            noise_db_min=zone.min_db, noise_db_max=zone.max_db
        )


def assign_district_and_noise(queryset):
    queryset.update(district=containing_district())
    assign_noise(queryset)
