import csv
import hashlib
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.contrib.gis.geos import GEOSGeometry, Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import (
    Apartment,
    ApartmentHistory,
    DataVersion,
    District,
    NoiseZone,
)


DEFAULT_PATH = "/app/scraped_data/complete_listings.csv"

ROOMS_MAP = {
    "ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5,
    "SIX": 6, "SEVEN": 7, "EIGHT": 8, "NINE": 9, "TEN": 10,
}

TRACKED_FIELDS = ["price", "area", "rooms", "is_active", "validation_status"]


def parse_rooms(value):
    """ONE/TWO/3 -> int; pusty/nieznany -> None."""
    if value is None:
        return None
    v = str(value).strip().upper()
    if not v:
        return None
    if v in ROOMS_MAP:
        return ROOMS_MAP[v]
    try:
        return int(v)
    except ValueError:
        return None


def parse_bool(value):
    """'True'/'False'/'' -> bool/None."""
    if value is None:
        return None
    v = str(value).strip().lower()
    if v in ("true", "1", "yes", "tak"):
        return True
    if v in ("false", "0", "no", "nie"):
        return False
    return None


def parse_decimal(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return Decimal(str(value).strip().replace(",", "."))
    except InvalidOperation:
        return None


def parse_int(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(float(str(value).strip()))
    except ValueError:
        return None


def parse_location(value):
    """'POINT(18.6 54.4)' -> Point(srid=4326)."""
    if not value:
        return None
    try:
        geom = GEOSGeometry(str(value).strip(), srid=4326)
        if geom.geom_type == "Point":
            return geom
    except Exception:
        pass
    return None


def find_containing(point, candidates):
    """Spatial join in-memory."""
    if point is None:
        return None
    for c in candidates:
        if c.geometry.contains(point):
            return c
    return None


def validate(row):
    """
    Podstawowa walidacja: zwraca (status, notes).
    status: "valid" | "suspicious" | "invalid"
    notes: list[str] z powodami
    """
    notes = []
    status = "valid"

    price = parse_decimal(row.get("price"))
    area = parse_decimal(row.get("area"))

    if not row.get("external_id"):
        notes.append("missing external_id")
        status = "invalid"
    if not parse_location(row.get("location")):
        notes.append("missing or invalid location")
        status = "invalid"

    if price is not None:
        if price <= 0:
            notes.append("price <= 0")
            status = "suspicious"
        elif price > 50000:
            notes.append("price > 50000 (czy to nie sprzedaz?)")
            status = "suspicious"
    else:
        notes.append("no price")
        status = "suspicious"

    if area is not None:
        if area <= 0:
            notes.append("area <= 0")
            status = "suspicious"
        elif area > 500:
            notes.append("area > 500 m2")
            status = "suspicious"

    return status, notes


class Command(BaseCommand):
    help = "Importuje oferty ze scrapera (CSV) do tabeli Apartment."

    def add_arguments(self, parser):
        parser.add_argument("--path", default=DEFAULT_PATH)
        parser.add_argument(
            "--source",
            default="otodom",
            help="Wartosc DataVersion.source (info, z ktorego portalu pochodzi import).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Tylko parsuj i raportuj, niczego nie zapisuj.",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"Plik nie istnieje: {path}")

        last = DataVersion.objects.order_by("-version_number").first()
        next_number = (last.version_number + 1) if last else 1

        version = DataVersion(
            version_number=next_number,
            source=opts["source"],
            description=f"Scrape import z {path.name}",
        )
        if not opts["dry_run"]:
            version.save()
            self.stdout.write(f"Utworzono DataVersion v{next_number}.")
        else:
            self.stdout.write(f"[DRY] Symulacja DataVersion v{next_number}.")

        districts = list(District.objects.all())
        noise_zones = list(NoiseZone.objects.all())
        if not districts:
            self.stderr.write(self.style.WARNING(
                "Brak dzielnic. Najpierw load_districts."
            ))

        existing = {
            (a.external_id, a.source_portal): a
            for a in Apartment.objects.select_related("last_updated_in").all()
        }
        seen_keys = set()

        stats = {
            "new": 0, "updated": 0, "unchanged": 0,
            "skipped": 0, "suspicious": 0, "invalid": 0,
        }

        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                external_id = (row.get("external_id") or "").strip()
                source_portal = (row.get("source_portal") or "").strip()
                if not external_id or not source_portal:
                    stats["skipped"] += 1
                    continue

                key = (external_id, source_portal)
                if key in seen_keys:
                    stats["skipped"] += 1
                    continue
                seen_keys.add(key)

                val_status, val_notes = validate(row)
                if val_status == "invalid":
                    stats["invalid"] += 1
                if val_status == "suspicious":
                    stats["suspicious"] += 1

                location = parse_location(row.get("location"))
                district = find_containing(location, districts)
                zone = find_containing(location, noise_zones)

                fields = {
                    "source_url": (row.get("source_url") or "").strip(),
                    "title": (row.get("title") or "").strip()[:500],
                    "description": (row.get("description") or "").strip(),
                    "offer_type": (row.get("offer_type") or "rent").strip(),
                    "price": parse_decimal(row.get("price")) or Decimal("0"),
                    "area": parse_decimal(row.get("area")) or Decimal("0"),
                    "rooms": parse_rooms(row.get("rooms")),
                    "floor": parse_int(row.get("floor")),
                    "year_built": parse_int(row.get("year_built")),
                    "has_elevator": parse_bool(row.get("has_elevator")),
                    "is_accessible": parse_bool(row.get("is_accessible")),
                    "location": location,
                    "address": (row.get("address") or "").strip()[:500],
                    "district": district,
                    "noise_db_min": zone.min_db if zone else None,
                    "noise_db_max": zone.max_db if zone else None,
                    "is_active": True,
                    "validation_status": val_status,
                    "validation_notes": val_notes,
                }

                existing_apt = existing.get(key)

                if existing_apt is None:
                    if not opts["dry_run"]:
                        new_apt = Apartment.objects.create(
                            external_id=external_id,
                            source_portal=source_portal,
                            first_seen_in=version,
                            last_updated_in=version,
                            **fields,
                        )
                        existing[key] = new_apt
                    stats["new"] += 1
                else:
                    changed = []
                    for f in TRACKED_FIELDS:
                        if getattr(existing_apt, f) != fields[f]:
                            changed.append(f)

                    if changed:
                        if not opts["dry_run"]:
                            ApartmentHistory.objects.create(
                                apartment=existing_apt,
                                version=existing_apt.last_updated_in,
                                price=existing_apt.price,
                                area=existing_apt.area,
                                rooms=existing_apt.rooms,
                                is_active=existing_apt.is_active,
                                validation_status=existing_apt.validation_status,
                                changed_fields=changed,
                                raw_snapshot={
                                    f: str(getattr(existing_apt, f))
                                    for f in TRACKED_FIELDS
                                },
                            )
                            for f, v in fields.items():
                                setattr(existing_apt, f, v)
                            existing_apt.last_updated_in = version
                            existing_apt.save()
                        stats["updated"] += 1
                    else:
                        if not opts["dry_run"]:
                            existing_apt.last_updated_in = version
                            existing_apt.save(update_fields=["last_updated_in"])
                        stats["unchanged"] += 1

        portal = opts["source"]
        gone = 0
        for key, apt in existing.items():
            if apt.source_portal != portal:
                continue
            if key in seen_keys:
                continue
            if not apt.is_active:
                continue
            if not opts["dry_run"]:
                ApartmentHistory.objects.create(
                    apartment=apt,
                    version=apt.last_updated_in,
                    price=apt.price,
                    area=apt.area,
                    rooms=apt.rooms,
                    is_active=True,
                    validation_status=apt.validation_status,
                    changed_fields=["is_active"],
                    raw_snapshot={"is_active": True},
                )
                apt.is_active = False
                apt.last_updated_in = version
                apt.save(update_fields=["is_active", "last_updated_in"])
            gone += 1

        if not opts["dry_run"]:
            version.items_seen = len(seen_keys)
            version.items_new = stats["new"]
            version.items_updated = stats["updated"]
            from django.utils import timezone
            version.finished_at = timezone.now()
            version.save()

        prefix = "[DRY] " if opts["dry_run"] else ""
        self.stdout.write(self.style.SUCCESS(
            f"\n{prefix}Import v{next_number} zakonczony:\n"
            f"  nowe:          {stats['new']}\n"
            f"  zaktualizowane:{stats['updated']}\n"
            f"  bez zmian:     {stats['unchanged']}\n"
            f"  zniknele:      {gone}\n"
            f"  suspicious:    {stats['suspicious']}\n"
            f"  invalid:       {stats['invalid']}\n"
            f"  pominiete:     {stats['skipped']}\n"
        ))

        if opts["dry_run"]:
            transaction.set_rollback(True)