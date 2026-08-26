#!/usr/bin/env bash
set -e
export MSYS_NO_PATHCONV=1

set -a
source .env
set +a

: "${DB_USER:?set DB_USER in .env}"
: "${DB_NAME:?set DB_NAME in .env}"

docker compose up -d db
until docker compose exec -T db pg_isready -U "$DB_USER" >/dev/null 2>&1; do sleep 0.2; done
docker compose cp ./backup.dump db:/tmp/backup.dump
docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner /tmp/backup.dump