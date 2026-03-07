# ⚙️ Architektura Backend i API

Backend oparty jest na **Django REST Framework** i służy głównie do
serwowania danych analitycznych przetworzonych z plików CSV.

## 📂 Źródła Danych (CSV)

System nie korzysta w tym momencie z relacyjnej bazy danych do
przechowywania ofert (PostgreSQL służy do autentykacji użytkowników).
Dane analityczne ładowane są bezpośrednio z plików CSV.

!!! info "Zaleta rozwiązania" Pliki CSV mogą być podmieniane przez
zewnętrzny skrypt (Scraper) w wolumenie Dockera `/app/data/`. Django
odczytuje je "na żywo" przy każdym zapytaniu (z wykorzystaniem
`pandas`), co pozwala na łatwą aktualizację danych bez migracji bazy.

## 📡 Lista Endpointów

### 1. Mapa Bezpieczeństwa

Zwraca dane o przestępczości w dzielnicach Gdańska. Używane do
kolorowania mapy (Choropleth).

-   Metoda: `GET`
-   Endpoint: `/api/safety/`
-   Plik źródłowy: `bezpieczenstwo_gdansk.csv`

Przykładowa odpowiedź:

``` json
[
  {
    "dzielnica": "Śródmieście",
    "wskaznik_przestepstw": 120.5
  },
  {
    "dzielnica": "Przymorze Wielkie",
    "wskaznik_przestepstw": 45.2
  }
]
```

### 2. Oferty Mieszkań

Zwraca listę aktywnych ofert sprzedaży/wynajmu. Dane te są wyświetlane
jako pinezki na mapie oraz lista w panelu bocznym.

-   Metoda: `GET`
-   Endpoint: `/api/apartments/`
-   Plik źródłowy: `mieszkania.csv` (Mockup / Dane ze scrapera)

Przykładowa odpowiedź:

``` json
[
  {
    "id": 1,
    "tytul": "Apartament nad Motławą",
    "cena": 3500,
    "lat": 54.35,
    "lon": 18.65,
    "dzielnica": "Śródmieście"
  }
]
```

## 🔐 Autentykacja (JWT)

Backend obsługuje rejestrację i logowanie użytkowników z wykorzystaniem
tokenów JWT.

-   Rejestracja: `POST /api/auth/register/`
-   Logowanie: `POST /api/auth/login/`
