#!/usr/bin/env bash
# Üzemi figyelő — a kartotek-figyelo.timer 5 percenként futtatja (root).
#
# Ellenőrzi: API-k (/health + DB), Keycloak, MongoDB, lemez, a napi mentés frissessége és
# épsége, a TLS-tanúsítványok lejárata. ÁLLAPOTVÁLTÁSKOR (OK→HIBA, HIBA→OK) a journalba ír:
#   journalctl -t kartotek-figyelo          — a riasztások
#   cat /var/lib/kartotek-figyelo/utolso.txt — a legutóbbi futás minden ellenőrzése
# Ha a /etc/kartotek-figyelo.env-ben RIASZTAS_EMAIL be van állítva, e-mailt is küld (sendmail).
set -uo pipefail
ITT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
# shellcheck source=kornyezetek.sh
. "$ITT/kornyezetek.sh"
# shellcheck disable=SC1091
[ -f /etc/kartotek-figyelo.env ] && . /etc/kartotek-figyelo.env

ALLAPOT_DIR=/var/lib/kartotek-figyelo
KULSO_IP="${KULSO_IP:-144.126.144.220}" # a cPanel-vhostok erre az IP-re kötnek, nem a 127.0.0.1-re
mkdir -p "$ALLAPOT_DIR"
SOROK=()

riaszt() {
  [ -n "${RIASZTAS_EMAIL:-}" ] || return 0
  printf 'Subject: [kartotek] %s\nTo: %s\nFrom: %s\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' \
    "$1" "$RIASZTAS_EMAIL" "${RIASZTAS_FELADO:-kartotek-figyelo@$(hostname -f)}" "$2" | /usr/sbin/sendmail -t || true
}

ellenoriz() { # <név> <parancs…>
  local nev="$1" kimenet allapot elozo
  shift
  if kimenet="$("$@" 2>&1)"; then allapot=OK; else allapot=HIBA; fi
  kimenet="$(echo "$kimenet" | tr '\n' ' ' | cut -c1-240)"
  elozo="$(cat "$ALLAPOT_DIR/$nev" 2>/dev/null || echo OK)"
  echo "$allapot" > "$ALLAPOT_DIR/$nev"
  SOROK+=("$(printf '%-20s %-5s %s' "$nev" "$allapot" "$kimenet")")
  if [ "$allapot" != "$elozo" ]; then
    if [ "$allapot" = HIBA ]; then
      logger -t kartotek-figyelo -p user.err "HIBA: $nev — $kimenet"
      riaszt "HIBA: $nev" "$nev: $kimenet"
    else
      logger -t kartotek-figyelo -p user.notice "HELYREÁLLT: $nev — $kimenet"
      riaszt "helyreállt: $nev" "$nev: $kimenet"
    fi
  fi
}

api() { # <port>
  local v
  v="$(curl -fs --max-time 5 "http://127.0.0.1:$1/health")" || { echo "nem válaszol"; return 1; }
  [[ "$v" == *'"csatlakozva":true'* ]] || { echo "a DB nincs csatlakozva: $v"; return 1; }
  echo "$v" | grep -o '"kiadas":"[^"]*"'
}
keycloak() {
  curl -fs --max-time 5 -o /dev/null http://127.0.0.1:8080/realms/kartotek/.well-known/openid-configuration \
    || { echo "a Keycloak nem válaszol"; return 1; }
  echo ok
}
lemez() {
  local p
  p="$(df --output=pcent /home | tail -1 | tr -dc '0-9')"
  echo "/home ${p}% foglalt"
  [ "$p" -lt "${LEMEZ_KUSZOB:-85}" ]
}
mentes() {
  local f kor
  f="$(ls -1t /var/backups/kartotek/kartotek-*.sha256 2>/dev/null | head -1)"
  [ -n "$f" ] || { echo "nincs mentés"; return 1; }
  kor=$((($(date +%s) - $(stat -c %Y "$f")) / 3600))
  echo "legutóbbi: $(basename "$f" .sha256), ${kor} órája"
  [ "$kor" -lt 26 ] || return 1
  (cd /var/backups/kartotek && sha256sum -c --quiet "$(basename "$f")")
}
tanusitvany() { # <host>
  local veg nap
  veg="$(echo | openssl s_client -connect "$KULSO_IP:443" -servername "$1" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  [ -n "$veg" ] || { echo "$1: nem olvasható"; return 1; }
  nap=$((($(date -d "$veg" +%s) - $(date +%s)) / 86400))
  echo "$1: még $nap nap"
  [ "$nap" -ge 14 ]
}

for k in $KARTOTEK_KORNYEZETEK; do
  kornyezet_betolt "$k"
  systemctl cat "$SZOLGALTATAS" >/dev/null 2>&1 || continue
  ellenoriz "api-$k" api "$PORT"
  ellenoriz "tls-${URL#https://}" tanusitvany "${URL#https://}"
done
ellenoriz keycloak keycloak
ellenoriz tls-sso.aru.hu tanusitvany sso.aru.hu
ellenoriz mongod systemctl is-active mongod
ellenoriz lemez lemez
ellenoriz mentes mentes

{ date '+%F %T'; printf '%s\n' "${SOROK[@]}"; } > "$ALLAPOT_DIR/utolso.txt"
