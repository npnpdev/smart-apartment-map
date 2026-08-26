import csv
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.db.models import PointField
from django.db.models import OuterRef, Subquery
from django.db.models.functions import Cast

from api.models import District, EducationFacility



UNIVERSITY_KEYWORDS = ("uniwersytet", "akademia", "politechnika", "wyższa szkoła")
PRIMARY_KEYWORDS = ("podstawow", "podstawów")
SECONDARY_KEYWORDS = ("liceum", "technikum", "branżowa", "branzowa", "zawodowa")


def classify(row):
    amenity = (row.get("amenity") or "").strip().lower()
    name = (row.get("name") or "").strip().lower()
    school_type = (row.get("school") or "").strip().lower()
    isced = (row.get("isced:level") or "").strip()

    if amenity == "kindergarten":
        return "kindergarten"

    if amenity in ("university", "college") or any(k in name for k in UNIVERSITY_KEYWORDS):
        return "university"

    if amenity == "school":
        if "1" in isced or "2" in isced:
            return "primary"
        if "3" in isced:
            return "secondary"
        if school_type == "primary":
            return "primary"
        if school_type in ("secondary", "technical_college"):
            return "secondary"
        if any(k in name for k in PRIMARY_KEYWORDS):
            return "primary"
        if any(k in name for k in SECONDARY_KEYWORDS):
            return "secondary"

    return "other"


class Command(BaseCommand):
    help = "Wgrywa placowki edukacyjne z CSV do tabeli EducationFacility."

    def add_arguments(self, parser):
        parser.add_argument("--path", default="data/edukacja.csv")
        parser.add_argument("--clear", action="store_true")

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"Plik nie istnieje: {path}")

        if opts["clear"]:
            count = EducationFacility.objects.count()
            EducationFacility.objects.all().delete()
            self.stdout.write(f"Skasowano {count} placowek edukacyjnych.")

        if not District.objects.exists():
            self.stderr.write(self.style.WARNING(
                "Brak dzielnic w bazie. Najpierw odpal load_districts."
            ))
            return

        facilities = []
        skipped = 0
        no_district = 0

        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    lat = float(row["@lat"])
                    lng = float(row["@lon"])
                except (KeyError, ValueError, TypeError):
                    skipped += 1
                    continue

                # Point(x, y) ; w GIS x=longitude, y=latitude
                point = Point(lng, lat, srid=4326)

                facilities.append(EducationFacility(
                    name=(row.get("name") or "").strip(),
                    facility_type=classify(row),
                    raw_amenity=(row.get("amenity") or "").strip(),
                    raw_school_tag=(row.get("school") or "").strip(),
                    raw_isced=(row.get("isced:level") or "").strip(),
                    location=point,
                ))

        EducationFacility.objects.bulk_create(facilities, batch_size=500)

        EducationFacility.objects.filter(district__isnull=True).update(
            district=Subquery(
                District.objects.filter(
                    geometry__contains=Cast(
                        OuterRef("location"), PointField(srid=4326)
                    )
                ).values("id")[:1]
            )
        )
        no_district = EducationFacility.objects.filter(district__isnull=True).count()

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {len(facilities)} placowek "
            f"(pominieto {skipped}, bez dzielnicy {no_district})."
        ))