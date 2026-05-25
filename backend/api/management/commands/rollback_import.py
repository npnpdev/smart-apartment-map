"""
Cofa import o podanym numerze wersji.

Uzycie:
    python manage.py rollback_import 5
    python manage.py rollback_import 5 --yes   (bez pytania o potwierdzenie)
"""

from django.core.management.base import BaseCommand, CommandError

from api.services.rollback import RollbackError, rollback_version


class Command(BaseCommand):
    help = "Cofa (rollback) import danych o podanym numerze wersji."

    def add_arguments(self, parser):
        parser.add_argument("version_number", type=int)
        parser.add_argument("--yes", action="store_true", help="Pomija pytanie o potwierdzenie.")

    def handle(self, *args, **opts):
        n = opts["version_number"]

        if not opts["yes"]:
            confirm = input(f"Na pewno cofnac import v{n}?"f"[tak/nie]: ")
            if confirm.strip().lower() not in ("tak", "t", "yes", "y"):
                self.stdout.write("Anulowano.")
                return

        try:
            summary = rollback_version(n)
        except RollbackError as e:
            raise CommandError(str(e))

        self.stdout.write(self.style.SUCCESS(
            f"Rollback v{n} zakonczony:\n"
            f"  usunieto nowych mieszkan:   {summary['deleted']}\n"
            f"  przywrocono zmienionych:    {summary['restored']}\n"
            f"  pominieto (brak historii):  {summary['skipped']}"
        ))