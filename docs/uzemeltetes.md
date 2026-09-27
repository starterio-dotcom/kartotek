# Üzemeltetési kézikönyv — aru.hu VPS

Ez a leírás a `garofita-vps` szerveren futó éles és staging környezetre vonatkozik. A szerver cPanel-es AlmaLinux 8 (Contabo, 144.126.144.220), SSH-n root hozzáféréssel.
A konténeres (docker compose) út a README-ben van.

## Környezetek

| | Éles | Staging |
|---|---|---|
| Cím | https://aru.hu | https://staging.aru.hu (noindex, „TESZTKÖRNYEZET” jelvény) |
| API (systemd) | `kartotek-api`, 127.0.0.1:3011 | `kartotek-api-staging`, 127.0.0.1:3012 |
| Kiadások | `/home/radiatus/kartotek/eles/releases/*`, futó: `…/eles/current` | `/home/radiatus/kartotek/staging/…` |
| Mellékletek | `/home/radiatus/kartotek/eles/tarhely` | `/home/radiatus/kartotek/staging/tarhely` |
| Web docroot | `/home/radiatus/aru.hu` | `/home/radiatus/staging.aru.hu` |
| Adatbázis | MongoDB `kartotek` (rs0) | MongoDB `kartotek_staging` (ugyanaz a mongod) |
| Keycloak realm | `kartotek` | `kartotek-staging` (teszt-fiókokkal) |
| Környezeti változók | `/etc/kartotek-api.env` | `/etc/kartotek-api-staging.env` |

A környezetek paraméterei: `scripts/szerver/kornyezetek.sh`.

**Titkok** (csak root olvassa):
- `/root/kartotek-secrets.txt`: Keycloak-admin, Keycloak-DB, a staging teszt-jelszó;
- `/etc/kartotek-api*.env`;
- `/etc/kartotek-mentes.env`.

## Kiadás (deploy)

```bash
scripts/deploy.sh staging            # a HEAD commit a stagingre
scripts/deploy.sh eles               # élesre — csak ha a stagingen UGYANEZ a commit fut
scripts/deploy.sh eles <ref> --staging-nelkul   # vészhelyzetben, előléptetés nélkül
```

A commit tartalma kerül ki (`git archive`); a nem commitolt változás nem. A szerveren a `scripts/szerver/telepit.sh` fut, ugyanabból a commitból:

1. Új kiadás-könyvtár.
2. `pnpm install --frozen-lockfile`.
3. shared → api → web build (környezetfüggő `VITE_*` értékekkel).
4. A `current` szimlink átállítása, majd a szolgáltatás újraindítása.
5. **Egészség-ellenőrzés:** a `/health` a VÁRT kiadást mutatja, és a DB csatlakozva van.
   - Ha nem egészséges → **automatikus visszaállás** az előző kiadásra. A web nem cserélődik, a hibás kiadás törlődik, az ok a `journalctl -u <szolgáltatás>`-ban.
6. Csak ezután cserélődik a web (rsync a docrootba).

A legutóbbi 5 kiadás megmarad. Hogy mi fut: `curl https://aru.hu/health` → `"kiadas": "<dátum>-<commit>"`.

## Visszaállítás (rollback)

```bash
ssh garofita-vps kartotek-visszaallit eles --lista      # telepített kiadások, * = fut
ssh garofita-vps kartotek-visszaallit eles              # az aktuálisat megelőzőre
ssh garofita-vps kartotek-visszaallit eles <kiadás>     # egy megnevezettre
```

Csak a kódot állítja vissza (kb. 2 mp), az adatbázist nem. A séma-változások additívak, a régebbi kód az újabb adaton is fut.

**Régi (kiadás előtti) telepítés:** a `/home/radiatus/kartotek-app` még megvan tartaléknak (2026-09-27). Rá visszaállni: `ln -sfn /home/radiatus/kartotek-app /home/radiatus/kartotek/eles/current && systemctl restart kartotek-api`. Ha az új szerkezet egy-két hétig gond nélkül fut, törölhető.

## Staging

A teszt-fiókok (kiss.anna, szabo.julia, toth.bence, varga.dora, nagy.peter) a `kartotek-staging` realmben élnek. A közös jelszavuk: `KEYCLOAK_STAGING_TESZT_PASSWORD` a titokfájlban. Szerepkörök:
- Júlia: Jóváhagyó (3R);
- Bence: Olvasó (3R);
- Anna: Szerző (3R);
- Dóra: Szerző (Terminus);
- Péter: globális Admin.

A staging adatbázis újratöltése a példaadatokkal. **A védelem miatt csak a `kartotek_staging` DB-re fut.** Az env-fájlt NE `source`-old, mert az URI-ban lévő `&` szétvágja.

```bash
ssh garofita-vps 'U=$(grep ^MONGO_URI= /etc/kartotek-api-staging.env | cut -d= -f2-)
case "$U" in *"/kartotek_staging?"*) ;; *) echo "nem a staging DB!"; exit 1;; esac
cd /home/radiatus/kartotek/staging/current && sudo -u radiatus env MONGO_URI="$U" node apps/api/dist/seed/futtat.js'
```

## Mentés és helyreállítás

A mentést a cron indítja naponta 03:15-kor (`/etc/cron.d/kartotek-backup` → `/usr/local/bin/kartotek-mongo-backup.sh`, az éles deploy frissíti). A kimenet a `/var/backups/kartotek` mappába kerül:
- `*.archive.gz`: mongodump;
- `*.tarhely.tgz`: mellékletek;
- `*.sha256`;
- `offsite/*.tar.gpg`: a három fájl GPG-vel titkosítva.

14 készlet marad meg.

**Titkosítás:** a nyilvános kulcs (ujjlenyomat `84D41F58AA8BCD48B6B9EC53B86E3CF22B8A2F17`) a szerveren van. **A titkos kulcs nincs a szerveren**: a `G:\fejlesztes\kartotek\mentes-kulcs\` mappában jött létre. Tárold offline (jelszókezelő + külön adathordozó), és töröld a munkagépről. Nélküle a titkosított mentés nem bontható ki.

**Külső cél bekapcsolása:**
1. `rclone config` (root), és hozz létre egy remote-ot, pl. `b2`.
2. A `/etc/kartotek-mentes.env`-ben: `MENTES_OFFSITE_CEL=b2:vodor/kartotek`.

**Helyreállítás** (éles):

```bash
# titkosított csomagból (a titkos kulcsot birtokló gépen):
gpg -d kartotek-<BÉLYEG>.tar.gpg | tar -xf -  &&  sha256sum -c kartotek-<BÉLYEG>.sha256
# a szerveren:
systemctl stop kartotek-api
mongorestore --drop --gzip --archive=kartotek-<BÉLYEG>.archive.gz --nsInclude='kartotek.*'
rm -rf /home/radiatus/kartotek/eles/tarhely/* && tar -xzf kartotek-<BÉLYEG>.tarhely.tgz -C /home/radiatus/kartotek/eles/tarhely
chown -R radiatus:radiatus /home/radiatus/kartotek/eles/tarhely
systemctl start kartotek-api && curl -s 127.0.0.1:3011/health
```

A DB-t és a tárhelyet mindig ugyanabból a készletből (azonos bélyeg) állítsd vissza.

## Figyelés és riasztás

A `kartotek-figyelo.timer` 5 percenként futtatja a `/usr/local/lib/kartotek/figyelo.sh`-t. Az ellenőrzések:
- mindkét API `/health`-e (DB-vel);
- Keycloak;
- mongod;
- a `/home` lemez (85% alatt);
- a legutóbbi mentés (26 óránál frissebb, és a sha256 ép);
- TLS-lejárat (14 napnál több van hátra).

Ha egy ellenőrzés állapota változik, a figyelő bejegyzést ír:

```bash
journalctl -t kartotek-figyelo                      # riasztások (HIBA / HELYREÁLLT)
cat /var/lib/kartotek-figyelo/utolso.txt            # a legutóbbi futás minden sora
```

**E-mail riasztás:** a `/etc/kartotek-figyelo.env`-be írd be: `RIASZTAS_EMAIL=cím@…` (és opcionálisan `RIASZTAS_FELADO=`). A küldés a helyi sendmailen (exim) megy. Megbízható kézbesítéshez előbb az aru.hu SPF/DKIM rekordjait kell felvenni a Forpsi DNS-ben.

A teljes szerver kiesését a szerver maga nem veszi észre. Ehhez külső figyelő kell, pl. UptimeRobot a `https://aru.hu/health` címre.

## Keycloak

- **Admin:** `kartotek-admin` (master realm). A jelszó a titokfájlban van.
- **Keményítés:**
  - brute-force védelem: 5 hiba után egyre hosszabb várakozás, legfeljebb 15 perc;
  - jelszószabály (a következő jelszócserétől érvényes): legalább 12 karakter, nem lehet a felhasználónév vagy az e-mail, az utolsó 3 jelszó nem ismételhető;
  - bejelentkezési és admin-eseménynapló, 90 napig.
- **Kétlépcsős azonosítás:** egyelőre nincs kötelezővé téve. Bekapcsolás felhasználónként: Admin-konzol → Users → *Required user actions* → *Configure OTP*.
- **Demo-fiókok az éles realmben:** kiss.anna, nagy.peter, varga.dora — **tiltva**. Az alkalmazásban Nagy Péter nem globális Admin.

**Új felhasználó felvétele (éles):**
1. Keycloak → `kartotek` realm → Users → *Add user*. Az e-mail az azonosító.
2. *Credentials*: ideiglenes jelszó („Temporary” = bekapcsolva).
3. Az alkalmazás adatbázisában is legyen felhasználó, ugyanazzal az e-maillel (az automatikus felvétel ki van kapcsolva, `OIDC_AUTO_PROVISION`):

   ```bash
   mongosh "mongodb://localhost:27017/kartotek?replicaSet=rs0&directConnection=true" --eval \
     'db.felhasznalos.updateOne({email:"uj.felhasznalo@szervezet.hu"},{$setOnInsert:{nev:"Új Felhasználó",email:"uj.felhasznalo@szervezet.hu",tagsagok:[],globalisAdmin:false}},{upsert:true})'
   ```

4. Szerepkör kiosztása a felületen: **☖ Felhasználók** (globális Admin).

## Nyitott tételek (döntés vagy erőforrás kell)

- **E-mail (SMTP):** az értesítések ma a felületen vannak (`ERTESITES_EMAIL=naplo`). Bekapcsolásához SMTP-adatok, vagy SPF/DKIM az aru.hu-hoz kell.
- **Külső mentési cél:** az rclone-remote (a titkosítás már működik).
- **Kétlépcsős azonosítás:** legalább az adminoknak.
- **Dedikált / izolált gazdagép** és **többtagú replica set:** a VPS ma megosztott más oldalakkal, és a Mongo egy node-on fut.
- **OS-tűzfal:** a Mongo, a Keycloak és az API ma csak localhoston figyel. Tűzfal a megosztott cPanel-szerveren a többi oldal miatt körültekintést igényel.
- **Keycloak-adminfelület korlátozása:** az `/admin` jelenleg bárhonnan elérhető (brute-force védelemmel). Célszerű IP-hez kötni.
