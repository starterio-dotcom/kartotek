#!/usr/bin/env bash
# Kiadás a VPS-re egy git-commitból.
#
#   scripts/deploy.sh staging [git-ref]     → staging.aru.hu
#   scripts/deploy.sh eles    [git-ref]     → aru.hu (csak ha ugyanez a commit a stagingen már fut)
#   scripts/deploy.sh eles    [git-ref] --staging-nelkul   → előléptetés-ellenőrzés nélkül (vészhelyzet)
#
# A commit tartalma kerül ki (git archive), a nem commitolt változás nem. A szerveren a
# scripts/szerver/telepit.sh buildel, vált, egészséget ellenőriz, és hiba esetén visszaáll.
# Visszaállítás kézzel: ssh <szerver> kartotek-visszaallit <eles|staging> [--lista | <kiadás>]
set -euo pipefail

KORNY="${1:-}"
REF="${2:-HEAD}"
KAPCSOLO="${3:-}"
SZERVER="${KARTOTEK_SZERVER:-garofita-vps}"
case "$KORNY" in
  eles | staging) ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

cd "$(git rev-parse --show-toplevel)"
SHA="$(git rev-parse --short=8 "$REF^{commit}")"
if [ -n "$(git status --porcelain)" ]; then
  echo "Figyelem: a munkafa nem tiszta — a(z) $REF ($SHA) commit tartalma megy ki, a nem commitolt változás NEM." >&2
fi

if [ "$KORNY" = eles ] && [ "$KAPCSOLO" != "--staging-nelkul" ]; then
  # Előléptetés: élesre csak az mehet, ami a stagingen már fut és egészséges.
  STG="$(curl -fs --max-time 15 https://staging.aru.hu/health || true)"
  if [[ "$STG" != *"-$SHA\""* ]] || [[ "$STG" != *'"csatlakozva":true'* ]]; then
    echo "A stagingen nem a(z) $SHA fut (vagy nem egészséges): ${STG:-nincs válasz}" >&2
    echo "Előbb: scripts/deploy.sh staging $REF   (vészhelyzetben: --staging-nelkul)" >&2
    exit 1
  fi
fi

KIADAS="$(date +%Y%m%d-%H%M%S)-$SHA"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive --format=tar.gz -o "$TMP/forras.tgz" "$REF"
echo "== $KORNY ← $KIADAS ($(git log -1 --format=%s "$REF"))"
scp -q "$TMP/forras.tgz" "$SZERVER:/tmp/kartotek-$KIADAS.tgz"
# A szerveroldali szkriptek a KIADOTT commitból futnak (nem a helyi munkafából).
ssh "$SZERVER" "D=\$(mktemp -d) && tar xzf /tmp/kartotek-$KIADAS.tgz -C \$D scripts/szerver \
  && bash \$D/scripts/szerver/telepit.sh $KORNY $KIADAS /tmp/kartotek-$KIADAS.tgz; RC=\$?; \
  rm -rf \$D /tmp/kartotek-$KIADAS.tgz; exit \$RC"
