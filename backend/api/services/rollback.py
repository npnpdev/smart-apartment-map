from django.db import transaction

from api.models import Apartment, ApartmentHistory, DataVersion


class RollbackError(Exception):
    pass


def _has_newer_version(version):
    return DataVersion.objects.filter(
        version_number__gt=version.version_number
    ).exists()


@transaction.atomic
def rollback_version(version_number):
    try:
        version = DataVersion.objects.get(version_number=version_number)
    except DataVersion.DoesNotExist:
        raise RollbackError(f"Wersja {version_number} nie istnieje")

    if _has_newer_version(version):
        raise RollbackError(f"Wersja {version_number} nie jest najnowsza")

    summary = {"deleted": 0, "restored": 0, "skipped": 0}

    new_apartments = Apartment.objects.filter(first_seen_in=version)
    summary["deleted"] = new_apartments.count()
    new_apartments.delete()

    updated = (Apartment.objects.filter(last_updated_in=version).exclude(first_seen_in=version))

    for apt in updated:
        prev = (
            ApartmentHistory.objects.filter(apartment=apt)
            .order_by("-id")
            .first()
        )
        if prev is None:
            apt.last_updated_in = apt.first_seen_in
            apt.save(update_fields=["last_updated_in"])
            summary["skipped"] += 1
            continue

        apt.price = prev.price
        apt.area = prev.area
        apt.rooms = prev.rooms
        apt.is_active = prev.is_active
        apt.validation_status = prev.validation_status
        apt.last_updated_in = prev.version 
        apt.save(update_fields=[
            "price", "area", "rooms",
            "is_active", "validation_status", "last_updated_in",
        ])
        prev.delete()
        summary["restored"] += 1

    version.delete()

    return summary