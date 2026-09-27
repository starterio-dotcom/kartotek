#!/usr/bin/env bash
# Éles (systemd/bare-metal) mentés a VPS-en — cron hívja naponta.
# Telepítve: /usr/local/bin/kartotek-mongo-backup.sh (az éles deploy frissíti).
#
# MongoDB + a feltöltött mellékletek (tárhely) EGYÜTT, közös időbélyeggel, integritás-
# ellenőrzéssel és rotációval. A kettőt együtt kell visszaállítani.
#
# Külső (offsite) példány — a /etc/kartotek-mentes.env szabályozza:
#   MENTES_GPG_CIMZETT=<ujjlenyomat>  → a készletből titkosított csomag: $DIR/offsite/*.tar.gpg
#                                        (a titkos kulcs NINCS a szerveren — csak a nyilvános)
#   MENTES_OFFSITE_CEL=<rclone-cél>   → a titkosított csomagot oda is felmásolja (pl. b2:vodor/kartotek)
set -euo pipefail

# shellcheck disable=SC1091
[ -f /etc/kartotek-mentes.env ] && . /etc/kartotek-mentes.env
DIR="${KARTOTEK_BACKUP_DIR:-/var/backups/kartotek}"
TARHELY_DIR="${TARHELY_DIR:-/home/radiatus/kartotek/eles/tarhely}"
MEGTART="${KARTOTEK_BACKUP_KEEP:-14}"
BELYEG="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DIR"

# 1) MongoDB
mongodump --db=kartotek --archive --gzip > "$DIR/kartotek-$BELYEG.archive.gz"

# 2) Feltöltött mellékletek (a könyvtár hiányát üres archívumként kezeljük)
if [ -d "$TARHELY_DIR" ]; then
  tar -czf "$DIR/kartotek-$BELYEG.tarhely.tgz" -C "$TARHELY_DIR" .
else
  tar -czf "$DIR/kartotek-$BELYEG.tarhely.tgz" -T /dev/null
fi

# 3) Integritás-ellenőrző
( cd "$DIR" && sha256sum "kartotek-$BELYEG.archive.gz" "kartotek-$BELYEG.tarhely.tgz" \
    > "kartotek-$BELYEG.sha256" )

# 4) Ellenőrzés (hibás archívum ne maradjon csendben)
gzip -t "$DIR/kartotek-$BELYEG.archive.gz"
tar -tzf "$DIR/kartotek-$BELYEG.tarhely.tgz" >/dev/null

# 5) Titkosított külső példány (a három fájl egy csomagban; csak a kulcs gazdája bonthatja ki)
if [ -n "${MENTES_GPG_CIMZETT:-}" ]; then
  mkdir -p "$DIR/offsite"
  tar -cf - -C "$DIR" "kartotek-$BELYEG.archive.gz" "kartotek-$BELYEG.tarhely.tgz" "kartotek-$BELYEG.sha256" \
    | gpg --batch --yes --trust-model always --recipient "$MENTES_GPG_CIMZETT" \
        --output "$DIR/offsite/kartotek-$BELYEG.tar.gpg" --encrypt
  if [ -n "${MENTES_OFFSITE_CEL:-}" ]; then
    rclone copy "$DIR/offsite/kartotek-$BELYEG.tar.gpg" "$MENTES_OFFSITE_CEL"
  fi
  ls -1t "$DIR"/offsite/kartotek-*.tar.gpg 2>/dev/null | tail -n +$((MEGTART + 1)) | xargs -r rm -f
fi

# 6) Rotáció: a legutóbbi $MEGTART készlet marad (mindhárom fájltípusra).
for minta in "archive.gz" "tarhely.tgz" "sha256"; do
  ls -1t "$DIR"/kartotek-*."$minta" 2>/dev/null | tail -n +$((MEGTART + 1)) | xargs -r rm -f
done
