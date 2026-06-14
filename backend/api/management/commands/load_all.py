   
#python manage.py load_all
#--clear   przekazuje --clear do kazdego loadera (reimport od zera)


from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Odpala wszystkie loadery danych w poprawnej kolejnosci."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Czysci tabele przed wgraniem (przekazane do kazdego loadera).",
        )

    def handle(self, *args, **opts):
        clear = opts["clear"]

        loaders = [
            "load_districts",
            "load_noise",
            "load_education",
            "load_safety",
            "seed_apartments",
        ]

        for name in loaders:
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n>> {name}"))
            if clear:
                call_command(name, clear=True)
            else:
                call_command(name)

        self.stdout.write(self.style.SUCCESS("\n>> Wszystkie dane zaladowane."))