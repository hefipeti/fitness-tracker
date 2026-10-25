#!/usr/bin/env sh
# Creates backups/fitness-YYYY-MM-DD-HHMM.dump (PostgreSQL custom format).
set -eu
mkdir -p backups
target="backups/fitness-$(date +%Y-%m-%d-%H%M).dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > /tmp/backup.dump'
docker compose cp db:/tmp/backup.dump "$target"
docker compose exec -T db rm -f /tmp/backup.dump
echo "Backup written to $target"
