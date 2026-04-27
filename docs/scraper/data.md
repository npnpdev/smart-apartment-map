# :file_folder: Źródła danych

Dokument opisuje pliki danych dostępne w projekcie – ich lokalizację oraz zawarte kolumny.

---

## :world_map: Dzielnice

**Plik:** `backend/data/gdansk_dzielnice.geojson`

| Kolumna        | Typ     | Opis                                      |
|----------------|---------|-------------------------------------------|
| `@id`          | string  | Identyfikator relacji OSM                 |
| `name`         | string  | Nazwa dzielnicy (PL)                      |
| `name:de`      | string  | Nazwa dzielnicy (DE)                      |
| `admin_level`  | string  | Poziom administracyjny (wartość: `"9"`)   |
| `boundary`     | string  | Typ granicy (wartość: `"administrative"`) |
| `type`         | string  | Typ relacji OSM (wartość: `"boundary"`)   |
| `wikidata`     | string  | Identyfikator Wikidata                    |
| `wikipedia`    | string  | Link do artykułu Wikipedia                |
| `source`       | string  | Źródło danych (BIP Gdańsk)               |
| `source:image` | string  | URL obrazu źródłowego                     |
| `source:url`   | string  | URL strony źródłowej                      |
| `geometry`     | Polygon | Granica dzielnicy (WGS84)                 |

!!! note
    Ten sam plik jest skopiowany do `frontend/public/data/gdansk_dzielnice.geojson` na potrzeby warstwy mapy.

---

## :loud_sound: Hałas

=== "Dane surowe"
    **Plik:** `backend/data/gdansk_halas_ORG.geojson`

    | Kolumna      | Typ          | Opis                                          |
    |--------------|--------------|-----------------------------------------------|
    | `OBJECTID`   | integer      | Identyfikator strefy                          |
    | `MINVAL`     | integer      | Minimalny poziom hałasu w strefie (dB)        |
    | `MAXVAL`     | integer      | Maksymalny poziom hałasu w strefie (dB)       |
    | `geometry`   | MultiPolygon | Strefa hałasu                                 |

=== "Frontend"
    **Plik:** `frontend/public/data/gdansk_noise.geojson`

    Przetworzona wersja na potrzeby warstwy wektorowej mapy.

!!! warning "Uwaga"
    Kolumny w `gdansk_halas_ORG.geojson` to `OBJECTID`, `MINVAL`, `MAXVAL` – geometria to **MultiPolygon**. Należy zweryfikować, czy `gdansk_noise.geojson` używa tej samej struktury, czy jest przetworzona do innego schematu.

---

## :police_car: Bezpieczeństwo

**Plik:** `backend/data/bezpieczenstwo_gdansk.csv`

| Kolumna                | Typ    | Opis                                          |
|------------------------|--------|-----------------------------------------------|
| `dzielnica`            | string | Nazwa dzielnicy                               |
| `wskaznik_przestepstw` | float  | Wskaźnik przestępstw (liczba na 1000 mieszk.) |

---

## :blue_book: Przestępstwa

**Plik:** `backend/data/przestepstwa.xlsx`

Surowe dane z raportu GUS za rok 2023. Nagłówki kolumn znajdują się w **4. wierszu** arkusza (wiersze 1–3 to tytuł i uwagi metodologiczne).

| Kolumna                                       | Typ     | Opis                                          |
|-----------------------------------------------|---------|-----------------------------------------------|
| `LP.`                                         | integer | Liczba porządkowa                             |
| `DZIELNICA`                                   | string  | Nazwa dzielnicy                               |
| `LICZBA PRZESTĘPSTW W 2023 R.`                | integer | Łączna liczba przestępstw                     |
| `LICZBA LUDNOŚCI W 2023 R.`                   | integer | Liczba mieszkańców dzielnicy                  |
| `PRZESTĘPSTWA NA 1000 MIESZKAŃCÓW W 2023 R.`  | float   | Wskaźnik (kolumna zawiera formuły Excela)     |

!!! warning "Uwaga"
    Kolumna `PRZESTĘPSTWA NA 1000 MIESZKAŃCÓW W 2023 R.` zawiera formuły Excela (np. `=C5/D5*1000`), a nie przeliczone wartości. Przy wczytywaniu przez `pandas` lub `openpyxl` należy użyć `data_only=True`, aby odczytać wartości zamiast formuł.

---

## :school: Edukacja

=== "Aktualna wersja"
    **Plik:** `backend/data/edukacja.csv`

    | Kolumna       | Typ    | Opis                                          |
    |---------------|--------|-----------------------------------------------|
    | `@lat`        | float  | Szerokość geograficzna                        |
    | `@lon`        | float  | Długość geograficzna                          |
    | `name`        | string | Nazwa placówki                                |
    | `amenity`     | string | Typ obiektu OSM (np. `school`, `kindergarten`)|
    | `school`      | string | Podtyp szkoły (opcjonalne)                    |
    | `isced:level` | string | Poziom kształcenia wg klasyfikacji ISCED      |

=== "Stara wersja"
    **Plik:** `backend/data/edukacjaOLD.csv`

    | Kolumna  | Typ    | Opis                                          |
    |----------|--------|-----------------------------------------------|
    | `@lat`   | float  | Szerokość geograficzna                        |
    | `@lon`   | float  | Długość geograficzna                          |
    | `name`   | string | Nazwa placówki                                |
    | `amenity`| string | Typ obiektu OSM (np. `school`, `kindergarten`)|

    !!! warning "Stara wersja"
        Poprzednia wersja pliku – uboższa o kolumny `school` i `isced:level`. Należy ustalić, czy jest jeszcze potrzebna, czy można ją zarchiwizować.

---

## :house: Mieszkania

**Plik:** `backend/data/mieszkania.csv`

| Kolumna    | Typ    | Opis                                    |
|------------|--------|-----------------------------------------|
| `id`       | integer| Identyfikator rekordu                   |
| `name`     | string | Nazwa/adres mieszkania                  |
| `district` | string | Nazwa dzielnicy                         |
| `lat`      | float  | Szerokość geograficzna                  |
| `lng`      | float  | Długość geograficzna                    |
| `price`    | integer| Cena (zł/m²)                           |
| `noise_db` | integer| Poziom hałasu w lokalizacji (dB)        |
