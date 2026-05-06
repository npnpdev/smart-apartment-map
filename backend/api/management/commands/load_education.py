import csv
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError

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


def find_district(point, districts):
    for d in districts:
        if d.geometry.contains(point):
            return d
    return None


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

        # Ladujemy wszystkie dzielnice raz, do spatial join in-memory
        districts = list(District.objects.all())
        if not districts:
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
                district = find_district(point, districts)
                if district is None:
                    no_district += 1

                facilities.append(EducationFacility(
                    name=(row.get("name") or "").strip(),
                    facility_type=classify(row),
                    raw_amenity=(row.get("amenity") or "").strip(),
                    raw_school_tag=(row.get("school") or "").strip(),
                    raw_isced=(row.get("isced:level") or "").strip(),
                    location=point,
                    district=district,
                ))

        EducationFacility.objects.bulk_create(facilities, batch_size=500)

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {len(facilities)} placowek "
            f"(pominieto {skipped}, bez dzielnicy {no_district})."
        ))