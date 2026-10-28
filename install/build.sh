#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGING="$(mktemp -d)"
ARCHIVE="$SCRIPT_DIR/smart-app.tar.gz"

cd "$PROJECT_ROOT"

echo "[1/5] Budowanie obrazu backendu..."
docker build -t smart-app-backend:latest ./backend

echo "[2/5] Budowanie obrazu nginx z frontendem..."
docker build -f install/Dockerfile.nginx -t smart-app-nginx:latest .

echo "[3/5] Pobieranie obrazu bazy danych..."
docker pull postgis/postgis:16-3.4

echo "[4/5] Zapisywanie obrazów do plików..."
docker save postgis/postgis:16-3.4  -o "$STAGING/db.tar"
docker save smart-app-backend:latest -o "$STAGING/backend.tar"
docker save smart-app-nginx:latest   -o "$STAGING/nginx.tar"

cp install/docker-compose.install.yml "$STAGING/docker-compose.yml"
cp install/scrape.sh "$STAGING/scrape.sh"
chmod +x "$STAGING/scrape.sh"
cp .env.example "$STAGING/.env.example"
mkdir -p "$STAGING/certs"
mkdir -p "$STAGING/data"
cp -r scraper "$STAGING/scraper"
cp -r backend/data "$STAGING/static-data"

cat > "$STAGING/install.sh" << 'INSTALL_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

REQUIRED_DIR="/tmp/smart-app"
APP_DIR="$HOME/smart-app"
CERTS_DIR="$APP_DIR/nginx-certs"

if [ "$(pwd)" != "$REQUIRED_DIR" ]; then
    echo "Blad: uruchom skrypt z katalogu $REQUIRED_DIR"
    echo "  cd $REQUIRED_DIR && ./install.sh"
    exit 1
fi

echo "[1/6] Tworzenie katalogu $APP_DIR..."
mkdir -p "$CERTS_DIR"

echo "[2/6] Kopiowanie plikow konfiguracyjnych..."
cp docker-compose.yml "$APP_DIR/docker-compose.yml"
cp .env.example "$APP_DIR/.env.example"
cp scrape.sh "$APP_DIR/scrape.sh" && chmod +x "$APP_DIR/scrape.sh"
rm -rf "$APP_DIR/scraper"
cp -r scraper "$APP_DIR/scraper"
rm -rf "$APP_DIR/static-data"
cp -r static-data "$APP_DIR/static-data"
mkdir -p "$APP_DIR/data"
if [ ! -f "$APP_DIR/.env" ]; then
    cp .env.example "$APP_DIR/.env"
    echo "  Utworzono .env z szablonu — uzupelnij hasla przed uruchomieniem:"
    echo "  nano $APP_DIR/.env"
fi

echo "[3/6] Generowanie certyfikatow SSL (self-signed)..."
if [ ! -f "$CERTS_DIR/cert.pem" ] || [ ! -f "$CERTS_DIR/key.pem" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -subj "/CN=localhost" \
        -keyout "$CERTS_DIR/key.pem" \
        -out    "$CERTS_DIR/cert.pem" \
        2>/dev/null
    echo "  Wygenerowano self-signed cert w $CERTS_DIR"
    echo "  Zastap wlasnym certyfikatem Let's Encrypt przed wdrozeniem produkcyjnym."
else
    echo "  Certyfikaty juz istnieja — pomijam."
fi

echo "[4/6] Usuwanie starych kontenerow i obrazow (jesli istnieja)..."
if [ -f "$APP_DIR/docker-compose.yml" ]; then
    docker compose -f "$APP_DIR/docker-compose.yml" down --remove-orphans 2>/dev/null || true
fi
for img in smart-app-backend:latest smart-app-nginx:latest postgis/postgis:16-3.4; do
    if docker image inspect "$img" &>/dev/null; then
        docker rmi "$img"
    fi
done

echo "[5/6] Ladowanie obrazow Docker..."
docker load -i db.tar
docker load -i backend.tar
docker load -i nginx.tar

echo "[6/6] Konfigurowanie crontab..."
CRON_LINE="0 3 * * * cd $HOME/smart-app && bash scrape.sh >> $HOME/smart-app/scrape.log 2>&1"
if crontab -l 2>/dev/null | grep -qF "scrape.sh"; then
    echo "  Cron juz skonfigurowany — pomijam."
else
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "  Dodano cron: scraping codziennie o 3:00 w nocy."
fi

echo ""
echo "=============================================="
echo " Przejdz do folderu ~/smart-app i uruchom:"
echo "   cd ~/smart-app && docker compose up -d"
echo "=============================================="
echo ""
echo "Pamietaj o uzupelnieniu hasel w: $APP_DIR/.env"
INSTALL_SCRIPT

chmod +x "$STAGING/install.sh"

echo "[5/5] Pakowanie archiwum..."
tar -czf "$ARCHIVE" -C "$STAGING" .
rm -rf "$STAGING"

echo ""
echo "Gotowe: $ARCHIVE"
echo ""
echo "Wyslij na serwer:"
echo "  scp smart-app.tar.gz user@serwer:/tmp/"
echo ""
echo "Na serwerze Ubuntu:"
echo "  cd /tmp/smart-app"
echo "  tar xvf smart-app.tar.gz"
echo "  ./install.sh"
