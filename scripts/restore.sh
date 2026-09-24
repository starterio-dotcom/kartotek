#!/usr/bin/env bash
# Teljes visszaállítás az éles compose-ba: MongoDB + a feltöltött mellékletek (tárhely).
# Használat: scripts/restore.sh <archív-fájl>
#   Az azonos bélyegű .tarhely.tgz-t automatikusan megkeresi a DB-archívum mellett.
# FIGYELEM: a --drop eldobja a meglévő `kartotek` adatbázist a visszatöltés előtt.
set -euo pipefail

ARCHIV="${1:?Add meg a visszaállítandó archív fájlt (scripts/restore.sh kartotek-....archive.gz)}"
COMPOSE="docker compose -f docker-compose.prod.yml"
TARHELY_UT="${TARHELY_DIR_KONTENER:-/data/tarhely}"

[[ -f "${ARCHIV}" ]] || { echo "Nincs ilyen fájl: ${ARCHIV}" >&2; exit 1; }
TARHELY="${ARCHIV/.archive.gz/.tarhely.tgz}"

read -r -p "Biztosan visszaállítod? Ez eldobja a jelenlegi 'kartotek' DB-t. [igen/N] " valasz
[[ "${valasz}" == "igen" ]] || { echo "Megszakítva."; exit 1; }

echo "1/2 DB-visszaállítás: ${ARCHIV}"
${COMPOSE} exec -T mongo \
  mongorestore --db=kartotek --archive --gzip --drop < "${ARCHIV}"

if [[ -f "${TARHELY}" ]]; then
  echo "2/2 Tárhely-visszaállítás: ${TARHELY}"
  # A meglévő tartalom kiürítése, majd az archívum kibontása a kötetbe.
  ${COMPOSE} exec -T api sh -c "rm -rf ${TARHELY_UT}/* ${TARHELY_UT}/.[!.]* 2>/dev/null; tar -xzf - -C ${TARHELY_UT}" < "${TARHELY}"
else
  echo "FIGYELEM: nincs tárhely-archívum (${TARHELY}) — a mellékletek NEM állnak vissza!" >&2
fi

echo "Kész."
