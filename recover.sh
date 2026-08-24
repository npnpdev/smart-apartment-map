#!/usr/bin/env bash
set -e
export MSYS_NO_PATHCONV=1
docker compose up -d db
until docker compose exec -T db pg_isready -U smart_user >/dev/null 2>&1; do sleep 0.2; done
docker compose cp ./backup.dump db:/tmp/backup.dump
docker compose exec -T db pg_restore -U smart_user -d smart_apartment --clean --if-exists --no-owner /tmp/backup.dump