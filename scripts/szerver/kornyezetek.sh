# shellcheck shell=bash
# A VPS-en futó környezetek (éles, staging) paraméterei — a telepit.sh, a visszaallit.sh
# és a figyelo.sh közösen használja. Titkot NEM tartalmaz: azok a /etc/kartotek-api*.env-ben vannak.
#
# Könyvtárszerkezet környezetenként:
#   /home/radiatus/kartotek/<korny>/releases/<ÉÉÉÉHHNN-ÓÓPPMM>-<sha>/   egy-egy teljes kiadás
#   /home/radiatus/kartotek/<korny>/current -> releases/…               a futó kiadás (a systemd innen indít)
#   /home/radiatus/kartotek/<korny>/tarhely/                            feltöltött mellékletek (kiadásfüggetlen!)

KARTOTEK_KORNYEZETEK="eles staging"

kornyezet_betolt() {
  case "$1" in
    eles)
      SZOLGALTATAS=kartotek-api
      PORT=3011
      DOCROOT=/home/radiatus/aru.hu
      URL=https://aru.hu
      VITE_ENV="VITE_AUTH_MODE=oidc VITE_OIDC_AUTHORITY=https://sso.aru.hu/realms/kartotek VITE_OIDC_CLIENT_ID=kartotek-web VITE_API_URL="
      ;;
    staging)
      SZOLGALTATAS=kartotek-api-staging
      PORT=3012
      DOCROOT=/home/radiatus/staging.aru.hu
      URL=https://staging.aru.hu
      VITE_ENV="VITE_AUTH_MODE=oidc VITE_OIDC_AUTHORITY=https://sso.aru.hu/realms/kartotek-staging VITE_OIDC_CLIENT_ID=kartotek-web VITE_API_URL= VITE_KORNYEZET=staging"
      ;;
    *)
      echo "Ismeretlen környezet: '$1' (eles | staging)" >&2
      return 1
      ;;
  esac
  ALAP="/home/radiatus/kartotek/$1"
}

naplo() { echo "[$(date +%H:%M:%S)] $*"; }

# Megvárja, hogy az API egészséges legyen: válaszol, a DB csatlakozva, és (ha megadtuk)
# a várt kiadás fut. Használat: egeszseg_var <port> [kiadas] [mp=45]
egeszseg_var() {
  local port="$1" kiadas="${2:-}" max="${3:-45}" i valasz
  for ((i = 0; i < max; i++)); do
    valasz="$(curl -fs --max-time 3 "http://127.0.0.1:$port/health" 2>/dev/null || true)"
    if [[ "$valasz" == *'"csatlakozva":true'* ]] && { [ -z "$kiadas" ] || [[ "$valasz" == *"\"kiadas\":\"$kiadas\""* ]]; }; then
      return 0
    fi
    sleep 1
  done
  echo "Utolsó /health válasz: ${valasz:-(nincs)}" >&2
  return 1
}

# A `current` szimlinket atomikusan átállítja a megadott kiadás-könyvtárra.
current_atallit() {
  ln -sfn "$2" "$1/current.uj"
  mv -Tf "$1/current.uj" "$1/current"
}
