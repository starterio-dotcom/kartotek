#!/usr/bin/env bash
# MongoDB-mentés az éles compose `mongo` szolgáltatásából.
# Használat: scripts/backup.sh [cél-könyvtár]   (alap: ./mentes)
set -euo pipefail

CEL_DIR="${1:-./mentes}"
BELYEG="$(date +%Y%m%d-%H%M%S)"
ARCHIV="kartotek-${BELYEG}.archive.gz"
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "${CEL_DIR}"
echo "Mentés indul → ${CEL_DIR}/${ARCHIV}"

# A konténerben futtatott mongodump tömörített archívumot ír a stdoutra.
${COMPOSE} exec -T mongo \
  mongodump --db=kartotek --archive --gzip > "${CEL_DIR}/${ARCHIV}"

echo "Kész: ${CEL_DIR}/${ARCHIV}"
echo "Megjegyzés: a feltöltött mellékletek a 'tarhely-data' kötetben vannak —"
echo "azokat külön mentsd (pl. docker run --volumes-from ... tar)."
