import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Case, IntegerField, Value, When

from api.models import Apartment, DataVersion, District, NoiseZone
from api.services.spatial import assign_district_and_noise


SEED_VERSION_NUMBER = 1
SEED_SOURCE_PORTAL = "seed"
DEFAULT_AREA = Decimal("45.00")


def noise_from_csv(csv_noise):
    return Case(
        *[When(external_id=key, then=Value(db)) for key, db in csv_noise.items()],
        output_field=IntegerField(),
    )


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

        version, created = DataVersion.objects.get_or_create(
            version_number=SEED_VERSION_NUMBER,
            defaults={
                "source": "manual_seed",
                "description": "Mockowe dane do developmentu (mieszkania.csv)",
            },
        )
        if created:
            self.stdout.write(f"Utworzono DataVersion v{version.version_number}.")

        if not District.objects.exists():
            self.stderr.write(self.style.WARNING(
                "Brak dzielnic w bazie. Najpierw odpal load_districts."
            ))
            return

        if not NoiseZone.objects.exists():
            self.stdout.write(
                "NoiseZone pusty ; halas pojdzie z kolumny CSV.noise_db."
            )

        loaded = 0
        skipped = 0
        csv_noise = {}

        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    csv_id = row["id"].strip()
                    lat = float(row["lat"])
                    lng = float(row["lng"])
                    price = Decimal(row["price"])
                    row_noise = int(row["noise_db"]) if row.get("noise_db") else None
                except (KeyError, ValueError, TypeError, InvalidOperation) as e:
                    self.stderr.write(f"Pomijam wiersz id={row.get('id')}: {e}")
                    skipped += 1
                    continue

                point = Point(lng, lat, srid=4326)
                external_id = f"seed-{csv_id}"
                if row_noise is not None:
                    csv_noise[external_id] = row_noise

                Apartment.objects.update_or_create(
                    external_id=external_id,
                    source_portal=SEED_SOURCE_PORTAL,
                    defaults={
                        "title": (row.get("name") or f"Seed #{csv_id}").strip(),
                        "price": price,
                        "area": DEFAULT_AREA,
                        "rooms": None,
                        "offer_type": "rent",
                        "location": point,
                        "first_seen_in": version,
                        "last_updated_in": version,
                        "is_active": True,
                        "validation_status": "valid",
                        "validation_notes": [],
                    },
                )
                loaded += 1

        seeded = Apartment.objects.filter(source_portal=SEED_SOURCE_PORTAL)
        assign_district_and_noise(seeded)
        if csv_noise:
            seeded.filter(
                noise_db_min__isnull=True, external_id__in=csv_noise
            ).update(
                noise_db_min=noise_from_csv(csv_noise),
                noise_db_max=noise_from_csv(csv_noise),
            )

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {loaded} seedowych mieszkan (pominieto {skipped})."
        ))