import csv
import tempfile
from decimal import Decimal
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from api.models import Apartment, ApartmentHistory, DataVersion
from api.services.rollback import RollbackError, rollback_version


CSV_FIELDS = [
    "external_id", "source_portal", "source_url", "title", "description",
    "offer_type", "price", "area", "rooms", "floor", "year_built",
    "has_elevator", "is_accessible", "location", "address",
    "district_id", "noise_db_min", "noise_db_max",
]


def zapisz_csv(katalog, nazwa, oferty):
    sciezka = Path(katalog) / nazwa
    with sciezka.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for oferta in oferty:
            wiersz = {pole: "" for pole in CSV_FIELDS}
            wiersz.update(oferta)
            writer.writerow(wiersz)
    return str(sciezka)


def oferta(external_id="1", price="3000", area="45"):
    return {
        "external_id": external_id,
        "source_portal": "otodom",
        "title": f"Mieszkanie {external_id}",
        "offer_type": "rent",
        "price": price,
        "area": area,
        "location": "POINT(18.6466 54.3520)",
    }


class ImportRollbackTests(TestCase):

    def setUp(self):
        self.katalog = tempfile.mkdtemp()

    def importuj(self, oferty, nazwa="listings.csv"):
        sciezka = zapisz_csv(self.katalog, nazwa, oferty)
        call_command("import_scraped_apartments", path=sciezka, verbosity=0)

    def test_import_tworzy_oferte(self):
        self.importuj([oferta()])

        self.assertEqual(DataVersion.objects.count(), 1)
        self.assertEqual(Apartment.objects.count(), 1)

        apt = Apartment.objects.get()
        self.assertEqual(apt.price, Decimal("3000"))
        self.assertEqual(apt.first_seen_in.version_number, 1)
        self.assertEqual(apt.last_updated_in.version_number, 1)

    def test_rollback_wersji_bez_zmian(self):
        self.importuj([oferta()])
        self.importuj([oferta()])

        self.assertEqual(DataVersion.objects.count(), 2)
        apt = Apartment.objects.get()
        self.assertEqual(ApartmentHistory.objects.count(), 0)
        self.assertEqual(apt.last_updated_in.version_number, 1)

        rollback_version(2)

        apt.refresh_from_db()
        self.assertEqual(apt.last_updated_in.version_number, 1)
        self.assertFalse(DataVersion.objects.filter(version_number=2).exists())
        self.assertEqual(Apartment.objects.count(), 1)

    def test_rollback_nie_cofa_o_wersje_za_duzo(self):
        self.importuj([oferta(price="1000")])
        self.importuj([oferta(price="2000")])
        self.importuj([oferta(price="2000")])

        apt = Apartment.objects.get()
        self.assertEqual(apt.price, Decimal("2000"))
        self.assertEqual(ApartmentHistory.objects.count(), 1)

        rollback_version(3)

        apt.refresh_from_db()
        self.assertEqual(apt.price, Decimal("2000"), "rollback v3 zmienil cene z v2")
        self.assertEqual(apt.last_updated_in.version_number, 2)
        self.assertEqual(ApartmentHistory.objects.count(), 1, "rollback v3 skasowal historie v2")

    def test_rollback_cofa_zmiane_ceny(self):
        self.importuj([oferta(price="1000")])
        self.importuj([oferta(price="2000")])

        rollback_version(2)

        apt = Apartment.objects.get()
        self.assertEqual(apt.price, Decimal("1000"))
        self.assertEqual(apt.last_updated_in.version_number, 1)
        self.assertEqual(ApartmentHistory.objects.count(), 0)

    def test_rollback_usuwa_nowe_oferty(self):
        self.importuj([oferta("1")])
        self.importuj([oferta("1"), oferta("2")])

        self.assertEqual(Apartment.objects.count(), 2)

        rollback_version(2)

        self.assertEqual(Apartment.objects.count(), 1)
        self.assertEqual(Apartment.objects.get().external_id, "1")

    def test_znikniecie_oferty_deaktywuje(self):
        self.importuj([oferta("1"), oferta("2")])
        self.importuj([oferta("1")])

        self.assertTrue(Apartment.objects.get(external_id="1").is_active)
        self.assertFalse(Apartment.objects.get(external_id="2").is_active)

    def test_rollback_tylko_najnowszej_wersji(self):
        self.importuj([oferta(price="1000")])
        self.importuj([oferta(price="2000")])
        self.importuj([oferta(price="2000")])

        self.assertEqual(DataVersion.objects.count(), 3)
        with self.assertRaises(RollbackError):
            rollback_version(2)
