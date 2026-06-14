from pathlib import Path

import openpyxl
from django.core.management.base import BaseCommand, CommandError

from api.models import District, SafetyData


DISTRICT_ALIASES = {
    "Orunia - Św. Wojciech - Lipce": "Orunia - Święty Wojciech - Lipce",
    "Zaspa Młyniec": "Zaspa-Młyniec",
    "Zaspa Rozstaje": "Zaspa-Rozstaje",
    "Żabianka - Wejhera - Jelitkowo - Tysiąclecia":
        "Żabianka-Wejhera-Jelitkowo-Tysiąclecia",
}


def normalize_name(raw):
    raw = (raw or "").strip()
    return DISTRICT_ALIASES.get(raw, raw)


class Command(BaseCommand):
    help = "Wgrywa wskazniki bezpieczenstwa z XLSX do tabeli SafetyData."

    def add_arguments(self, parser):
        parser.add_argument("--path", default="data/przestepstwa.xlsx")
        parser.add_argument("--year", type=int, default=2023)
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Skasuj rekordy z podanego roku przed wgraniem.",
        )

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        if not path.exists():
            raise CommandError(f"Plik nie istnieje: {path}")

        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active

        if opts["clear"]:
            count = SafetyData.objects.filter(year=opts["year"]).count()
            SafetyData.objects.filter(year=opts["year"]).delete()
            self.stdout.write(f"Skasowano {count} rekordow z roku {opts['year']}.")

        districts_by_name = {d.name: d for d in District.objects.all()}
        if not districts_by_name:
            self.stderr.write(self.style.WARNING(
                "Brak dzielnic w bazie. Najpierw odpal load_districts."
            ))
            return

        loaded = 0
        skipped_unknown = 0

        for row in ws.iter_rows(min_row=5, values_only=True):
            if not row or not row[1]:
                continue

            
            if row[3] is None and row[4] is None:
                break

            district_name = normalize_name(row[1])
            district = districts_by_name.get(district_name)
            if not district:
                self.stderr.write(f"Pomijam (nieznana dzielnica): {row[1]}")
                skipped_unknown += 1
                continue

            try:
                crimes_total = int(row[2]) if row[2] is not None else None
                population = int(row[3]) if row[3] is not None else None
                index_per_1000 = float(row[4]) if row[4] is not None else 0.0
            except (TypeError, ValueError):
                self.stderr.write(f"Pomijam (zle dane): {row}")
                continue

            SafetyData.objects.update_or_create(
                district=district,
                year=opts["year"],
                defaults={
                    "crimes_total": crimes_total,
                    "population": population,
                    "crimes_per_1000": index_per_1000,
                    "source": "GUS",
                },
            )
            loaded += 1

        self.stdout.write(self.style.SUCCESS(
            f"Wgrano {loaded} rekordow safety za rok {opts['year']} "
            f"(nieznane dzielnice: {skipped_unknown})."
        ))