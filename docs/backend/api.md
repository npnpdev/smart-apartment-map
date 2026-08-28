# ⚙️ Architektura Backend i API

Backend oparty jest na **Django REST Framework** i **GeoDjango**. Wszystkie dane
przechowywane są w bazie **PostgreSQL z rozszerzeniem PostGIS** — pliki CSV i GeoJSON
z katalogu `backend/data/` służą wyłącznie jako źródło do jednorazowego wczytania.

!!! warning "Zmiana względem wcześniejszej wersji"
    Wcześniej Django odczytywało dane z plików CSV „na żywo" przy każdym zapytaniu
    (przez `pandas`), a PostgreSQL obsługiwał tylko logowanie. **Tak już nie jest.**
    Dane trafiają do bazy przez komendy `manage.py load_*` i tam są odpytywane.

## 🗄️ Model danych

| Model | Zawiera | Geometria |
|---|---|---|
| `District` | dzielnice Gdańska (z OSM) | `MultiPolygon` (geometry, 4326) |
| `NoiseZone` | strefy hałasu (min/max dB) | `MultiPolygon` (geometry, 4326) |
| `Apartment` | oferty mieszkań | `Point` (**geography**, 4326) |
| `EducationFacility` | przedszkola, szkoły, uczelnie | `Point` (**geography**, 4326) |
| `SafetyData` | wskaźnik przestępstw na dzielnicę i rok | — |
| `DataVersion`, `ApartmentHistory` | wersjonowanie importów | — |

!!! info "Dlaczego punkty są typu `geography`, a wielokąty `geometry`"
    Pola punktowe uczestniczą w zapytaniach o **odległość**. W typie `geometry`
    z układem WGS84 (SRID 4326) odległości liczone są w **stopniach**, a nie metrach,
    a zapytanie `distance_lte` nie korzysta z indeksu przestrzennego.
    Typ `geography` liczy w metrach i używa indeksu GiST.

    Wielokąty (`District`, `NoiseZone`) zostają typem `geometry`, bo służą do
    testu „czy punkt leży w obszarze" (`contains`), który na `geometry` działa
    poprawnie i szybko.

## 📡 Endpointy

Wszystkie poniższe są publiczne (`AllowAny`) i zwracają **płaską tablicę JSON**
bez paginacji — frontend konsumuje je bezpośrednio.

### Mieszkania

`GET /api/apartments/`

Domyślnie zwraca wyłącznie oferty aktywne (`is_active=True`) o statusie walidacji
`valid`. Aby zobaczyć pozostałe, trzeba jawnie podać parametr `is_active`
lub `validation_status`.

| Parametr | Przykład | Znaczenie |
|---|---|---|
| `price_min`, `price_max` | `price_max=3000` | widełki cenowe |
| `rooms` | `rooms=2` | liczba pokoi |
| `offer_type` | `offer_type=rent` | `rent` albo `sale` |
| `district` | `district=Wrzeszcz Górny` | nazwa dzielnicy |
| `near` + `radius_km` | `near=54.352,18.646&radius_km=2` | oferty w promieniu od punktu (`lat,lng`) |
| `edu_types` + `edu_radius` | `edu_types=Przedszkola,Podstawowe&edu_radius=1` | oferty mające **wszystkie** wskazane typy placówek w promieniu |
| `is_active`, `validation_status` | `validation_status=suspicious` | zdejmuje domyślne filtry |

!!! tip "Filtr `edu_types`"
    Przyjmuje etykiety używane przez frontend (`Przedszkola`, `Podstawowe`,
    `Średnie`, `Uczelnie`, `Inne`), klucze modelu (`kindergarten`, `primary`,
    `secondary`, `university`, `other`), a także zapis bez polskich znaków
    (`Srednie`). Nieznana wartość zwraca **400** z listą dozwolonych — filtr
    nigdy nie ignoruje po cichu typu, którego nie rozpoznał.

    Domyślny promień to 5 km. Wartość nieliczbowa zwraca 400, ujemna wraca
    do domyślnej.

Przykładowa odpowiedź:

```json
[
  {
    "id": 12,
    "name": "Apartament nad Motławą",
    "district": "Śródmieście",
    "lat": 54.35,
    "lng": 18.65,
    "price": "3500.00",
    "noise_db": 65,
    "title": "Apartament nad Motławą",
    "area": "48.00",
    "rooms": 2,
    "offer_type": "rent",
    "noise_db_min": 60,
    "noise_db_max": 65,
    "price_per_m2": 72.92,
    "is_active": true,
    "validation_status": "valid",
    "source_url": "https://..."
  }
]
```

!!! note "Klucze `name`, `district`, `lat`, `lng`, `noise_db`"
    To pola utrzymywane dla zgodności z frontendem (`useMapData.ts`,
    `useMapFilters.ts`, `RightSidePanel`). Zmiana ich nazw wymaga równoległej
    zmiany po stronie React.

### Placówki edukacyjne

`GET /api/education/`

| Parametr | Przykład |
|---|---|
| `facility_type` | `facility_type=kindergarten` |
| `district` | `district=Oliwa` |
| `near` + `radius_km` | `near=54.352,18.646&radius_km=1` |

Odpowiedź zawiera `education_type` (polska etykieta) oraz `isced:level`.

### Bezpieczeństwo

`GET /api/safety/` — wskaźnik przestępstw na 1000 mieszkańców, per dzielnica.
Parametr `year` zawęża rocznik.

```json
[
  { "dzielnica": "Śródmieście", "wskaznik_przestepstw": "120.500",
    "year": 2023, "population": 28000, "crimes_total": 3374 }
]
```

### Pozostałe

- `GET /api/districts/` — granice dzielnic jako `FeatureCollection` GeoJSON.
- `GET /api/noise/` — proxy do WMS `geogdansk.pl` z cache'em. **Obecnie nieużywane
  przez frontend**, który rysuje warstwę hałasu z lokalnego pliku
  `frontend/public/data/gdansk_noise.geojson`.
- `GET /api/health/` — `{"status": "ok"}`.

## 🕓 Wersjonowanie importów

Każde uruchomienie `import_scraped_apartments` tworzy nowy `DataVersion`.
Dla ofert, których śledzone pola się zmieniły (`price`, `area`, `rooms`,
`is_active`, `validation_status`), zapisywany jest wpis `ApartmentHistory`
ze stanem **sprzed** zmiany. Oferty nieobecne w nowym pliku są dezaktywowane
(`is_active=False`), nigdy nie są kasowane.

```bash
docker compose exec backend python manage.py import_scraped_apartments
docker compose exec backend python manage.py import_scraped_apartments --dry-run
docker compose exec backend python manage.py rollback_import 3 --yes
```

!!! warning "Rollback tylko najnowszej wersji"
    `rollback_import` odmawia cofnięcia wersji, po której powstała nowsza.
    Wersje trzeba cofać od najnowszej.

Oferty niezmienione w danym imporcie **nie mają przestawianego** `last_updated_in` —
dzięki temu rollback wie, do której wersji je przywrócić.

## 🔐 Autentykacja (JWT)

Model użytkownika loguje się adresem e-mail (`USERNAME_FIELD = "email"`).

| Metoda | Endpoint | Opis |
|---|---|---|
| `POST` | `/api/auth/register/` | rejestracja, zwraca od razu parę tokenów |
| `POST` | `/api/auth/login/` | logowanie (`email` + `password`) |
| `POST` | `/api/auth/refresh/` | odświeżenie tokenu dostępowego |
| `GET` | `/api/auth/me/` | dane zalogowanego użytkownika |

!!! danger "Domyślnie wymagane logowanie"
    W `REST_FRAMEWORK` ustawione jest `IsAuthenticated`. Każdy nowy widok
    publiczny musi **jawnie** ustawić `permission_classes = [AllowAny]`,
    inaczej zostanie zamknięty za logowaniem bez żadnego ostrzeżenia.
