#!/usr/bin/env bash
set -euo pipefail

TEST_MODE=0
if [[ "${1:-}" == "--test" ]]; then
    TEST_MODE=1
    echo "[TEST] Tryb testowy: 1 strona, 10 ogloszen"
fi

APP_DIR="$HOME/smart-app"
SCRAPER_DIR="$APP_DIR/scraper"
DATA_DIR="$APP_DIR/data"
VENV_DIR="$APP_DIR/scraper-venv"

if [ ! -d "$SCRAPER_DIR" ]; then
    echo "Blad: katalog scrapera nie istnieje: $SCRAPER_DIR"
    echo "Uruchom najpierw install.sh"
    exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
    echo "Blad: brak docker-compose.yml w $APP_DIR"
    exit 1
fi

echo "[1/6] Przygotowanie srodowiska Python..."
PYVER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
if [ ! -f "$VENV_DIR/bin/activate" ]; then
    rm -rf "$VENV_DIR"
    if ! python3 -m venv --upgrade-deps "$VENV_DIR" 2>/tmp/venv_err; then
        echo "Blad: nie mozna utworzyc virtualenv."
        echo "Zainstaluj jako root: apt install python${PYVER}-venv"
        cat /tmp/venv_err
        exit 1
    fi
fi
PYTHON="$VENV_DIR/bin/python"

"$PYTHON" -m pip install --quiet requests beautifulsoup4 cloudscraper

echo "[2/6] Uruchamianie collector.py (lista ogloszen)..."
mkdir -p "$SCRAPER_DIR/data"
rm -f "$SCRAPER_DIR/data/complete_listings.csv"
cd "$SCRAPER_DIR"
if [ "$TEST_MODE" -eq 1 ]; then
    MAX_PAGES=1 "$PYTHON" collector.py
else
    "$PYTHON" collector.py
fi

echo "[3/6] Uruchamianie detail_scraper.py (szczegoly ogloszen)..."
if [ "$TEST_MODE" -eq 1 ]; then
    MAX_DETAILS=10 "$PYTHON" detail_scraper.py
else
    "$PYTHON" detail_scraper.py
fi

echo "[4/6] Kopiowanie wynikow do $DATA_DIR..."
mkdir -p "$DATA_DIR"
if [ ! -f "$SCRAPER_DIR/data/complete_listings.csv" ]; then
    echo "Blad: brak pliku complete_listings.csv — detail_scraper nie zakonczyl pracy."
    exit 1
fi
cp "$SCRAPER_DIR/data/complete_listings.csv" "$DATA_DIR/complete_listings.csv"

echo "[5/6] Ladowanie dzielnic..."
docker compose -f "$APP_DIR/docker-compose.yml" exec backend \
    python manage.py load_districts

echo "[6/6] Import do bazy danych..."
docker compose -f "$APP_DIR/docker-compose.yml" exec backend \
    python manage.py import_scraped_apartments

echo ""
echo "Gotowe. Dane zostaly zaimportowane do bazy danych."
