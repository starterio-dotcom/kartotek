#!/usr/bin/env bash
# Egy kiadás telepítése a VPS-en (root futtatja; a scripts/deploy.sh hívja).
#
#   telepit.sh <eles|staging> <kiadás-azonosító> <forrás.tar.gz>
#
# Lépések: kicsomagolás új kiadás-könyvtárba → függőségek + build (radiatus) → `current`
# átállítása → szolgáltatás-újraindítás → egészség-ellenőrzés (DB + a VÁRT kiadás fut).
# Ha az új kiadás nem egészséges, AUTOMATIKUSAN visszaáll az előzőre, és a web nem cserélődik.
# A web (statikus fájlok) csak sikeres API-váltás után kerül ki.
set -euo pipefail
ITT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=kornyezetek.sh
. "$ITT/kornyezetek.sh"

KORNY="${1:?Használat: telepit.sh <eles|staging> <kiadás> <forrás.tar.gz>}"
KIADAS="${2:?hiányzik a kiadás-azonosító}"
FORRAS="${3:?hiányzik a forrás tar.gz}"
kornyezet_betolt "$KORNY"
UJ="$ALAP/releases/$KIADAS"

systemctl cat "$SZOLGALTATAS" >/dev/null 2>&1 || { echo "Nincs ilyen szolgáltatás: $SZOLGALTATAS" >&2; exit 1; }
[ -e "$UJ" ] && { echo "Ez a kiadás már létezik: $UJ" >&2; exit 1; }

naplo "== $KORNY ← $KIADAS"
mkdir -p "$UJ" "$ALAP/tarhely"
tar xzf "$FORRAS" -C "$UJ"
echo "$KIADAS" > "$UJ/KIADAS"
chown -R radiatus:radiatus "$ALAP"

naplo "Függőségek és build (radiatus)…"
# CI=true + confirmModulesPurge=false: a pnpm nem kérdez (interaktív kérdésen korábban elakadt a deploy).
if ! sudo -u radiatus -H bash -c "set -eo pipefail; cd '$UJ'
    CI=true pnpm install --frozen-lockfile --config.confirmModulesPurge=false > /tmp/kartotek-install-$KIADAS.log 2>&1 \
      || { tail -30 /tmp/kartotek-install-$KIADAS.log; exit 1; }
    pnpm --filter @kartotek/shared build
    pnpm --filter @kartotek/api build
    env $VITE_ENV pnpm --filter @kartotek/web build > /tmp/kartotek-web-$KIADAS.log 2>&1 \
      || { tail -30 /tmp/kartotek-web-$KIADAS.log; exit 1; }"; then
  echo "HIBA: a build sikertelen — a futó kiadás érintetlen." >&2
  rm -rf "$UJ"
  exit 1
fi
rm -f "/tmp/kartotek-install-$KIADAS.log" "/tmp/kartotek-web-$KIADAS.log"
test -f "$UJ/apps/web/dist/.htaccess" || { echo "HIBA: a web-buildből hiányzik a .htaccess" >&2; rm -rf "$UJ"; exit 1; }
if grep -rq "localhost:3001" "$UJ/apps/web/dist/assets/"; then
  echo "HIBA: a web-build localhost API-ra mutat (VITE_API_URL)" >&2
  rm -rf "$UJ"
  exit 1
fi

ELOZO="$(readlink -e "$ALAP/current" 2>/dev/null || true)"
naplo "API-váltás (előző: ${ELOZO:-nincs})…"
current_atallit "$ALAP" "$UJ"
systemctl restart "$SZOLGALTATAS"

if ! egeszseg_var "$PORT" "$KIADAS"; then
  echo "HIBA: az új kiadás nem lett egészséges." >&2
  journalctl -u "$SZOLGALTATAS" -n 25 --no-pager >&2 || true
  if [ -n "$ELOZO" ] && [ -d "$ELOZO" ]; then
    naplo "Automatikus visszaállás: $ELOZO"
    current_atallit "$ALAP" "$ELOZO"
    systemctl restart "$SZOLGALTATAS"
    if egeszseg_var "$PORT" "$(cat "$ELOZO/KIADAS" 2>/dev/null || true)"; then
      naplo "Visszaállva — az előző kiadás fut, a web nem változott."
    else
      echo "KRITIKUS: a visszaállás után sem egészséges az API — kézi beavatkozás kell!" >&2
    fi
  fi
  exit 1
fi
naplo "API egészséges: $(curl -fs "http://127.0.0.1:$PORT/health")"

naplo "Web csere → $DOCROOT"
mkdir -p "$DOCROOT"
rsync -a --delete "$UJ/apps/web/dist/" "$DOCROOT/"
chown -R radiatus:radiatus "$DOCROOT"

# Üzemeltetési szkriptek a futó kiadásból (visszaállítás, figyelő, mentés).
install -d /usr/local/lib/kartotek
install -m 755 "$UJ"/scripts/szerver/*.sh /usr/local/lib/kartotek/
ln -sf /usr/local/lib/kartotek/visszaallit.sh /usr/local/bin/kartotek-visszaallit
if [ "$KORNY" = eles ]; then install -m 755 "$UJ/scripts/vps-backup.sh" /usr/local/bin/kartotek-mongo-backup.sh; fi

# Régi kiadások takarítása: a legutóbbi 5 marad; a futó és az előző soha nem törlődik.
find "$ALAP/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +6 | while read -r nev; do
  d="$ALAP/releases/$nev"
  if [ "$d" != "$UJ" ] && [ "$d" != "$ELOZO" ]; then rm -rf "$d"; naplo "törölve: $nev"; fi
done

naplo "KÉSZ: $KORNY → $KIADAS ($URL)"
