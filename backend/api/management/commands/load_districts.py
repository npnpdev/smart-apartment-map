import json
from pathlib import Path

from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand, CommandError

from api.models import District


class Command(BaseCommand):
    help = "Wgrywa dzielnice z GeoJSON do tabeli District."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default="data/gdansk_dzielnice.geojson",
            help="Sciezka do pliku GeoJSON (relatywna do backend/)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Skasuj istniejace dzielnice przed wgraniem.",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"Plik nie istnieje: {path}")

        with path.open(encoding="utf-8") as f:
            data = json.load(f)

        if opts["clear"]:
            count = District.objects.count()
            District.objects.all().delete()
            self.stdout.write(f"Skasowano {count} dzielnic.")

        loaded = 0
        skipped = 0

        for feature in data["features"]:
            geom = feature.get("geometry") or {}
            props = feature.get("properties", {})

            # Pomijamy punktowe etykiety
            if geom.get("type") not in ("Polygon", "MultiPolygon"):
                skipped += 1
                continue

            name = props.get("name")
            if not name:
                skipped += 1
                continue

            # GeoJSON ; GEOS; ujednolicamy do MultiPolygon
            geos_geom = GEOSGeometry(json.dumps(geom), srid=4326)
            if geos_geom.geom_type == "Polygon":
                geos_geom = MultiPolygon(geos_geom)

            # "@id": "relation/2642950" ; wyciagamy 2642950
            osm_id = None
            raw_id = props.get("@id", "")
            if raw_id.startswith("relation/"):
                try:
                    osm_id = int(raw_id.split("/", 1)[1])
                except (ValueError, IndexError):
                    pass

            District.objects.update_or_create(
                name=name,
                defaults={
                    "name_de": props.get("name:de", "") or "",
                    "osm_relation_id": osm_id,
                    "wikidata_id": props.get("wikidata", "") or "",
                    "geometry": geos_geom,
                },
            )
            loaded += 1

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {loaded} dzielnic (pominieto {skipped})."
        ))