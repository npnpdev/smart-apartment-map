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


KM_NA_STOPIEN = 111.32


def na_polnoc(lat, lng, km):
    return lat + km / KM_NA_STOPIEN, lng


class FiltryPrzestrzenneTests(TestCase):

    def setUp(self):
        from django.contrib.gis.geos import Point

        from api.models import EducationFacility

        self.wersja = DataVersion.objects.create(version_number=1, source="test")
        self.lat, self.lng = 54.3520, 18.6466

        self.apt = Apartment.objects.create(
            external_id="a1",
            source_portal="test",
            title="Mieszkanie testowe",
            price=3000,
            area=45,
            location=Point(self.lng, self.lat, srid=4326),
            first_seen_in=self.wersja,
            last_updated_in=self.wersja,
        )

        lat_p, lng_p = na_polnoc(self.lat, self.lng, 0.5)
        EducationFacility.objects.create(
            name="Przedszkole blisko",
            facility_type="kindergarten",
            location=Point(lng_p, lat_p, srid=4326),
        )

        lat_s, lng_s = na_polnoc(self.lat, self.lng, 3)
        EducationFacility.objects.create(
            name="Podstawowka daleko",
            facility_type="primary",
            location=Point(lng_s, lat_s, srid=4326),
        )

    def pobierz(self, query=""):
        odp = self.client.get(f"/api/apartments/{query}")
        self.assertEqual(odp.status_code, 200)
        return odp.json()

    def test_bez_filtrow_zwraca_mieszkanie(self):
        self.assertEqual(len(self.pobierz()), 1)

    def test_edu_typ_w_zasiegu(self):
        self.assertEqual(len(self.pobierz("?edu_types=Przedszkola&edu_radius=1")), 1)

    def test_edu_typ_poza_zasiegiem(self):
        self.assertEqual(len(self.pobierz("?edu_types=Podstawowe&edu_radius=1")), 0)

    def test_edu_wymaga_wszystkich_typow(self):
        self.assertEqual(
            len(self.pobierz("?edu_types=Przedszkola,Podstawowe&edu_radius=1")), 0
        )
        self.assertEqual(
            len(self.pobierz("?edu_types=Przedszkola,Podstawowe&edu_radius=5")), 1
        )

    def test_edu_przyjmuje_klucze_modelu(self):
        self.assertEqual(len(self.pobierz("?edu_types=kindergarten&edu_radius=1")), 1)

    def test_promien_jest_w_metrach(self):
        self.assertEqual(len(self.pobierz("?edu_types=Podstawowe&edu_radius=2.9")), 0)
        self.assertEqual(len(self.pobierz("?edu_types=Podstawowe&edu_radius=3.1")), 1)

    def test_near_filtruje_po_odleglosci(self):
        lat_d, lng_d = na_polnoc(self.lat, self.lng, 10)
        self.assertEqual(len(self.pobierz(f"?near={self.lat},{self.lng}&radius_km=1")), 1)
        self.assertEqual(len(self.pobierz(f"?near={lat_d},{lng_d}&radius_km=1")), 0)
        self.assertEqual(len(self.pobierz(f"?near={lat_d},{lng_d}&radius_km=15")), 1)

    def test_bledne_parametry_nie_wywalaja(self):
        self.assertEqual(len(self.pobierz("?near=abc")), 1)
        self.assertEqual(len(self.pobierz("?near=54.35")), 1)
        self.assertEqual(len(self.pobierz("?near=999,999&radius_km=1")), 1)


    def test_nieliczbowy_promien_to_blad(self):
        odp = self.client.get("/api/apartments/?edu_types=Przedszkola&edu_radius=zle")
        self.assertEqual(odp.status_code, 400)

    def test_ujemny_promien_wraca_do_domyslnego(self):
        self.assertEqual(len(self.pobierz("?edu_types=Podstawowe&edu_radius=-5")), 1)

    def test_nieznany_typ_to_blad(self):
        odp = self.client.get("/api/apartments/?edu_types=nieistniejacy")
        self.assertEqual(odp.status_code, 400)

    def test_typ_bez_polskich_znakow(self):
        from django.contrib.gis.geos import Point

        from api.models import EducationFacility

        lat_s, lng_s = na_polnoc(self.lat, self.lng, 0.4)
        EducationFacility.objects.create(
            name="Liceum blisko",
            facility_type="secondary",
            location=Point(lng_s, lat_s, srid=4326),
        )
        self.assertEqual(len(self.pobierz("?edu_types=Srednie&edu_radius=1")), 1)
        self.assertEqual(len(self.pobierz("?edu_types=%C5%9Arednie&edu_radius=1")), 1)


class LoaderEdukacjiTests(TestCase):

    def setUp(self):
        from django.contrib.gis.geos import MultiPolygon, Polygon

        from api.models import District

        District.objects.create(
            name="Dzielnica testowa",
            geometry=MultiPolygon(
                Polygon((
                    (18.60, 54.34), (18.70, 54.34),
                    (18.70, 54.37), (18.60, 54.37), (18.60, 54.34),
                ))
            ),
        )

        self.katalog = tempfile.mkdtemp()
        self.sciezka = Path(self.katalog) / "edukacja.csv"
        with self.sciezka.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f, fieldnames=["@lat", "@lon", "name", "amenity", "school", "isced:level"]
            )
            writer.writeheader()
            writer.writerow({
                "@lat": "54.3520", "@lon": "18.6466",
                "name": "Przedszkole nr 1", "amenity": "kindergarten",
                "school": "", "isced:level": "",
            })
            writer.writerow({
                "@lat": "54.3600", "@lon": "18.6500",
                "name": "Szkola Podstawowa nr 2", "amenity": "school",
                "school": "primary", "isced:level": "1",
            })

    def wczytaj(self):
        call_command("load_education", path=str(self.sciezka), verbosity=0)

    def test_loader_jest_idempotentny(self):
        from api.models import EducationFacility

        self.wczytaj()
        self.assertEqual(EducationFacility.objects.count(), 2)
        self.assertEqual(EducationFacility.objects.filter(district__isnull=False).count(), 2)

        self.wczytaj()
        self.wczytaj()
        self.assertEqual(EducationFacility.objects.count(), 2)

    def test_loader_aktualizuje_zmienione_dane(self):
        from api.models import EducationFacility

        self.wczytaj()

        with self.sciezka.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f, fieldnames=["@lat", "@lon", "name", "amenity", "school", "isced:level"]
            )
            writer.writeheader()
            writer.writerow({
                "@lat": "54.3520", "@lon": "18.6466",
                "name": "Przedszkole nr 1 po remoncie", "amenity": "kindergarten",
                "school": "", "isced:level": "",
            })
        self.wczytaj()

        self.assertEqual(EducationFacility.objects.count(), 2)
        self.assertTrue(
            EducationFacility.objects.filter(name="Przedszkole nr 1 po remoncie").exists()
        )
