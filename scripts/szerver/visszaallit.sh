#!/usr/bin/env bash
# Visszaállás egy korábbi kiadásra (root; telepítve: /usr/local/bin/kartotek-visszaallit).
#
#   kartotek-visszaallit <eles|staging>            → az aktuálisat megelőző kiadás
#   kartotek-visszaallit <eles|staging> <kiadás>   → a megnevezett kiadás
#   kartotek-visszaallit <eles|staging> --lista    → a telepített kiadások
#
# Csak a KÓDOT állítja vissza (API + web). Az adatbázist nem: a séma-változások additívak,
# így a korábbi kód az újabb adaton is fut. Adat-visszaállítás: docs/uzemeltetes.md.
set -euo pipefail
ITT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
# shellcheck source=kornyezetek.sh
. "$ITT/kornyezetek.sh"

KORNY="${1:?Használat: kartotek-visszaallit <eles|staging> [kiadás|--lista]}"
kornyezet_betolt "$KORNY"
JELEN="$(readlink -e "$ALAP/current")"
mapfile -t KIADASOK < <(find "$ALAP/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)

if [ "${2:-}" = "--lista" ]; then
  for k in "${KIADASOK[@]}"; do
    [ "$ALAP/releases/$k" = "$JELEN" ] && echo "* $k   (fut)" || echo "  $k"
  done
  exit 0
fi

if [ -n "${2:-}" ]; then
  CEL="$ALAP/releases/$2"
else
  CEL=""
  for k in "${KIADASOK[@]}"; do
    [ "$ALAP/releases/$k" = "$JELEN" ] && break
    CEL="$ALAP/releases/$k"
  done
fi
[ -n "$CEL" ] && [ -d "$CEL" ] || { echo "Nincs visszaállítható kiadás (${2:-az aktuális előtt})." >&2; exit 1; }
[ "$CEL" = "$JELEN" ] && { echo "Ez a kiadás fut már: $(basename "$CEL")"; exit 0; }

CEL_KIADAS="$(cat "$CEL/KIADAS")"
naplo "$KORNY: $(basename "$JELEN") → $CEL_KIADAS"
current_atallit "$ALAP" "$CEL"
systemctl restart "$SZOLGALTATAS"
if ! egeszseg_var "$PORT" "$CEL_KIADAS"; then
  echo "HIBA: a cél-kiadás nem egészséges — vissza az eredetire." >&2
  current_atallit "$ALAP" "$JELEN"
  systemctl restart "$SZOLGALTATAS"
  egeszseg_var "$PORT" "$(cat "$JELEN/KIADAS")" || echo "KRITIKUS: az eredeti sem egészséges!" >&2
  exit 1
fi
rsync -a --delete "$CEL/apps/web/dist/" "$DOCROOT/"
chown -R radiatus:radiatus "$DOCROOT"
naplo "KÉSZ: $KORNY → $CEL_KIADAS"
