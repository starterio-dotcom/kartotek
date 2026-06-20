#!/usr/bin/env bash
# MongoDB-visszaállítás mentésből az éles compose `mongo` szolgáltatásába.
# Használat: scripts/restore.sh <archív-fájl>
# FIGYELEM: a --drop eldobja a meglévő `kartotek` adatbázist a visszatöltés előtt.
set -euo pipefail

ARCHIV="${1:?Add meg a visszaállítandó archív fájlt (scripts/restore.sh kartotek-....archive.gz)}"
COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ ! -f "${ARCHIV}" ]]; then
  echo "Nincs ilyen fájl: ${ARCHIV}" >&2
  exit 1
fi

read -r -p "Biztosan visszaállítod? Ez eldobja a jelenlegi 'kartotek' DB-t. [igen/N] " valasz
[[ "${valasz}" == "igen" ]] || { echo "Megszakítva."; exit 1; }

echo "Visszaállítás: ${ARCHIV}"
${COMPOSE} exec -T mongo \
  mongorestore --db=kartotek --archive --gzip --drop < "${ARCHIV}"

echo "Kész."
