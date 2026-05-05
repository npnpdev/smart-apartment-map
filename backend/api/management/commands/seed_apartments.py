"""
Wgrywa MOCKOWE oferty mieszkan z mieszkania.csv do tabeli Apartment.

UWAGA: To sa dane TESTOWE (seed) na potrzeby developmentu Fazy 3.
Prawdziwe oferty wjada scraperem w Fazie 4 ze swoja logika
DataVersion / ApartmentHistory / walidacji.

CSV ma kolumny: id, name, district, lat, lng, price, noise_db
Modele wymagaja wiecej pol; brakujace lecimy z domyslnymi:
- area : 45 m2 (placeholder; CSV nie ma tej kolumny)
- rooms : None (nullable)
- offer_type : "rent"

source_portal="seed" pozwala odfiltrowac mocki od realnych ofert
i czysto je skasowac jak przyjdzie czas:
    Apartment.objects.filter(source_portal="seed").delete()
"""

import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Apartment, DataVersion, District, NoiseZone


SEED_VERSION_NUMBER = 1
SEED_SOURCE_PORTAL = "seed"
DEFAULT_AREA = Decimal("45.00")


def find_containing(point, candidates):
    """Zwraca pierwszy obiekt z `candidates`, ktorego geometry zawiera punkt."""
    for c in candidates:
        if c.geometry.contains(point):
            return c
    return None


class Command(BaseCommand):
    help = "Wgrywa testowe (seed) oferty mieszkan z mieszkania.csv."

    def add_arguments(self, parser):
        parser.add_argument("--path", default="data/mieszkania.csv")
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Skasuj wszystkie seedowe mieszkania przed wgraniem.",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"Plik nie istnieje: {path}")

        if opts["clear"]:
            qs = Apartment.objects.filter(source_portal=SEED_SOURCE_PORTAL)
            count = qs.count()
            qs.delete()
            self.stdout.write(f"Skasowano {count} seedowych mieszkan.")

        # DataVersion dla seedu; reuzywamy ten sam przy ponownych odpaleniach
        version, created = DataVersion.objects.get_or_create(
            version_number=SEED_VERSION_NUMBER,
            defaults={
                "source": "manual_seed",
                "description": "Mockowe dane do developmentu (mieszkania.csv)",
            },
        )
        if created:
            self.stdout.write(f"Utworzono DataVersion v{version.version_number}.")

        # Cache geo ; spatial join in-memory zeby uniknac N+1 zapytan
        districts = list(District.objects.all())
        if not districts:
            self.stderr.write(self.style.WARNING(
                "Brak dzielnic w bazie. Najpierw odpal load_districts."
            ))
            return

        noise_zones = list(NoiseZone.objects.all())
        if not noise_zones:
            self.stdout.write(
                "NoiseZone pusty ; halas pojdzie z kolumny CSV.noise_db."
            )

        loaded = 0
        skipped = 0

        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    csv_id = row["id"].strip()
                    lat = float(row["lat"])
                    lng = float(row["lng"])
                    price = Decimal(row["price"])
                    csv_noise = int(row["noise_db"]) if row.get("noise_db") else None
                except (KeyError, ValueError, TypeError, InvalidOperation) as e:
                    self.stderr.write(f"Pomijam wiersz id={row.get('id')}: {e}")
                    skipped += 1
                    continue

                point = Point(lng, lat, srid=4326)

                district = find_containing(point, districts)

                zone = find_containing(point, noise_zones) if noise_zones else None
                if zone is not None:
                    noise_min, noise_max = zone.min_db, zone.max_db
                elif csv_noise is not None:
                    # Fallback: jedna wartosc z CSV jako min=max
                    noise_min = noise_max = csv_noise
                else:
                    noise_min = noise_max = None

                Apartment.objects.update_or_create(
                    external_id=f"seed-{csv_id}",
                    source_portal=SEED_SOURCE_PORTAL,
                    defaults={
                        "title": (row.get("name") or f"Seed #{csv_id}").strip(),
                        "price": price,
                        "area": DEFAULT_AREA,
                        "rooms": None,
                        "offer_type": "rent",
                        "location": point,
                        "district": district,
                        "noise_db_min": noise_min,
                        "noise_db_max": noise_max,
                        "first_seen_in": version,
                        "last_updated_in": version,
                        "is_active": True,
                        "validation_status": "valid",
                        "validation_notes": [],
                    },
                )
                loaded += 1

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {loaded} seedowych mieszkan (pominieto {skipped})."
        ))