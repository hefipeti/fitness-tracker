# Creates backups\fitness-YYYY-MM-DD-HHmm.dump (PostgreSQL custom format).
# Run from the project folder:  .\scripts\backup.ps1
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path backups | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$target = "backups/fitness-$stamp.dump"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > /tmp/backup.dump'
docker compose cp db:/tmp/backup.dump $target
docker compose exec -T db rm -f /tmp/backup.dump
Write-Host "Backup written to $target"
