import json
from pathlib import Path

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand, CommandError

from api.models import NoiseZone


class Command(BaseCommand):
    help = "Wgrywa strefy halasu z GeoJSON do tabeli NoiseZone."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default="data/gdansk_halas_ORG.geojson",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Skasuj istniejace strefy przed wgraniem.",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"Plik nie istnieje: {path}")

        with path.open(encoding="utf-8") as f:
            data = json.load(f)

        if opts["clear"]:
            count = NoiseZone.objects.count()
            NoiseZone.objects.all().delete()
            self.stdout.write(f"Skasowano {count} stref halasu.")

        zones = []
        skipped = 0

        for feature in data["features"]:
            geom = feature.get("geometry") or {}
            props = feature.get("properties", {})

            if geom.get("type") not in ("Polygon", "MultiPolygon"):
                skipped += 1
                continue

            try:
                object_id = int(props["OBJECTID"])
                min_db = int(props["MINVAL"])
                max_db = int(props["MAXVAL"])
            except (KeyError, TypeError, ValueError):
                skipped += 1
                continue

            geos_geom = GEOSGeometry(json.dumps(geom), srid=4326)
            if geos_geom.geom_type == "Polygon":
                geos_geom = MultiPolygon(geos_geom)

            zones.append(NoiseZone(
                object_id=object_id,
                min_db=min_db,
                max_db=max_db,
                geometry=geos_geom,
            ))

        # ignore_conflicts ; zduplikowane object_id (UNIQUE) zostana pominiete
        NoiseZone.objects.bulk_create(zones, ignore_conflicts=True, batch_size=500)

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {len(zones)} stref halasu (pominieto {skipped})."
        ))