#!/usr/bin/env bash
# Teljes mentés az éles compose-ból: MongoDB + a feltöltött mellékletek (tárhely).
# Használat: scripts/backup.sh [cél-könyvtár]   (alap: ./mentes)
#
# KÉT artefaktumot ír, közös időbélyeggel:
#   kartotek-<bélyeg>.archive.gz   — mongodump (a kartotek adatbázis)
#   kartotek-<bélyeg>.tarhely.tgz  — a feltöltött melléklet-fájlok (tarhely-data kötet)
# Mindkettőhöz .sha256 integritás-ellenőrző készül. A DB-t és a fájlokat EGYÜTT kell
# visszaállítani, különben a mellékletek halott hivatkozások lesznek.
set -euo pipefail

CEL_DIR="${1:-./mentes}"
BELYEG="$(date +%Y%m%d-%H%M%S)"
ARCHIV="kartotek-${BELYEG}.archive.gz"
TARHELY="kartotek-${BELYEG}.tarhely.tgz"
COMPOSE="docker compose -f docker-compose.prod.yml"
TARHELY_UT="${TARHELY_DIR_KONTENER:-/data/tarhely}"

mkdir -p "${CEL_DIR}"

echo "1/2 MongoDB-mentés → ${CEL_DIR}/${ARCHIV}"
${COMPOSE} exec -T mongo \
  mongodump --db=kartotek --archive --gzip > "${CEL_DIR}/${ARCHIV}"

echo "2/2 Tárhely-mentés → ${CEL_DIR}/${TARHELY}"
# A tárhely az 'api' szolgáltatásba van csatolva; üres könyvtár is érvényes archívum.
${COMPOSE} exec -T api tar -czf - -C "${TARHELY_UT}" . > "${CEL_DIR}/${TARHELY}"

( cd "${CEL_DIR}" && sha256sum "${ARCHIV}" "${TARHELY}" > "kartotek-${BELYEG}.sha256" )

echo "Kész. Integritás-ellenőrzés:"
gzip -t "${CEL_DIR}/${ARCHIV}" && echo "  DB archívum ép."
tar -tzf "${CEL_DIR}/${TARHELY}" >/dev/null && echo "  Tárhely archívum ép."
echo "Visszaállítás: scripts/restore.sh ${CEL_DIR}/${ARCHIV}"
