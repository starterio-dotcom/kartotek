# Kartotékrendszer — Claude Code átadócsomag

Ez a csomag arra szolgál, hogy a **kartotékrendszer** prototípusból Claude Code segítségével működő, többfelhasználós webalkalmazás épüljön. Tartalmazza a projekt összefoglalóját, a teljes tervdokumentációt és a hátralévő feladatok részletes, fázisos ütemtervét.

## Mi van a csomagban

| Fájl | Tartalom |
|---|---|
| **`CLAUDE.md`** | A fő kontextus, amit a Claude Code automatikusan beolvas: a projekt lényege, az architektúra-döntés, a domain gyorsreferencia, a vasszabályok és az **archiválási szabályok**, valamint a munkamódszer. |
| `docs/adatmodell.md` | Teljes adatmodell: entitások, mezők, kapcsolatok, ID-séma, típus- és rétegrendszer. |
| `docs/allapotgep.md` | Az elem-verziók életciklusa: állapotok, átmenetek, szerepkörök, az ütemező és a tervezési indoklás. |
| `docs/velemenyezes-jovahagyas.md` | A véleményezési és jóváhagyási folyamat részletesen: négy-szem-elv, megjegyzések, döntés és hatályosság. |
| `docs/szerepkorok-jogosultsagok.md` | A szerepkör- és jogosultságrendszer: jogosultsági mátrix, hatókör, négy-szem-elv. |
| `docs/kapcsolatok.md` | Az öt tipizált kapcsolat és a validációs szabályaik. |
| `docs/architektura.md` | A javasolt Node.js/TypeScript + MongoDB architektúra, a stack, a repo-felépítés, a döntések és az alternatívák. |
| `docs/mongoose-sema.md` | A Mongoose séma vázlata (TypeScript): kollekciók, beágyazott altáblák, indexek. |
| `docs/domain-mag-vazlat.md` | A `shared` domain mag vázlata (TypeScript): állapotátmenet-tábla, ütemező-döntés, a `szabad()` jogosultság-függvény és a kapcsolat-validáció. |
| **`docs/utiterv.md`** | **A hátralévő feladatok részletesen, nyolc fázisra bontva, kész-kritériumokkal.** |
| `docs/migracio.md` | Hogyan megy át a prototípus logikája és példaadata az éles rendszerbe. |
| `docs/claude-code-inditas.md` | Indító promptok és ajánlott munkamenet a Claude Code-hoz. |
| `prototipus/` | Ide másold a `kartotek-prototipus-v4.html` fájlt (specifikáció + példaadatok). |

## Hogyan használd

1. Másold a csomag teljes tartalmát egy üres Git-repóba.
2. Tedd a `kartotek-prototipus-v4.html`-t a `prototipus/` mappába.
3. Indítsd a Claude Code-ot a repó gyökerében, és kövesd a `docs/claude-code-inditas.md` lépéseit — fázisról fázisra a `docs/utiterv.md` szerint.

## A választott irány dióhéjban

- **Stack:** pnpm-monorepo — React + Vite (web), Fastify (api), MongoDB + Mongoose, közös domain-mag a `packages/shared`-ben (Zod + állapotgép + ID + kapcsolatszabályok).
- **Elv:** a domain-logika egyszer, tisztán, tesztelve; az állapotgépet és a jogosultságot a backend kényszeríti ki; az auditnyom és az akadálymentesség (EN 301 549) elsőrangú, mert állami a megrendelő.
- **A prototípus marad a referencia** — nem dobjuk el, kiemeljük belőle, ami már bevált.

## Futtatás (fejlesztés)

> Előfeltétel: Node 20+, pnpm 9+, Docker (a MongoDB replica sethez).

```bash
pnpm install                 # függőségek (monorepo)
cp .env.example .env         # környezeti változók (Windows: copy)

pnpm db:up                   # MongoDB egy-node-os replica set (docker-compose)
pnpm --filter @kartotek/api seed   # példaadatok betöltése a v4 prototípusból
pnpm dev                     # apps/web (Vite, :5173) + apps/api (Fastify, :3001) párhuzamosan
```

- API életjel: `http://localhost:3001/health` — a frontend ezt jeleníti meg a kezdőképernyőn.
- OpenAPI / Swagger UI: `http://localhost:3001/dok` — a teljes `/api/*` felület böngészhető.
- Minőség: `pnpm typecheck` · `pnpm test` · `pnpm lint` (a CI mindhármat futtatja — `.github/workflows/ci.yml`).

### Hitelesítés fejlesztéshez

A v1 egy **fejlécalapú dev provider** mögött dolgozik (auth-provider interfész — később OIDC/SSO cserélhető be).
A kérésekhez add meg, ki vagy:

```bash
curl -H "x-felhasznalo-email: kiss.anna@pelda.hu" http://localhost:3001/api/elemek
```

Seed-felhasználók: `kiss.anna@pelda.hu` (Szerző@3R), `varga.dora@pelda.hu` (Szerző@Terminus),
`nagy.peter@pelda.hu` (globális Admin). A jogosultságot és az állapotgépet a backend kényszeríti ki.

A DB hiánya nem dönti le az API-t: a `/health` `db.csatlakozva=false`-t jelez, amíg a Mongo el nem indul.

### Csomagok

| Csomag | Mit tartalmaz |
|---|---|
| `packages/shared` | A domain-mag tiszta függvényei: `tipusok`, `azonosito`, `allapotgep` (+ ütemező), `jogosultsag` (`szabad()`), `kapcsolat` (validáció), `semak` (Zod). Vitesttel fedve. |
| `apps/api` | Fastify + Zod type provider + Swagger + Mongoose-modellek + seed. Teljes `/api/*`: szervezet/elem/verzió CRUD, állapotgép-átmenetek (audittal), véleményezés, kapcsolat-CRUD (validációval), RBAC + négy-szem-elv, ütemező, **mellékletek** (feltöltés/kiszolgálás/törlés, fájltárhely-absztrakció, verzió-fagyasztás), **kapcsolati gráf adat** (`/api/graf`). Integráció-teszt `mongodb-memory-server` replica set ellen. |
| `apps/web` | Vite + React + TS + Tailwind + TanStack Query + React Router + react-markdown + react-hook-form/Zod. Elemlista szűrőkkel, kartoték-nézet (verzióválasztó, státuszjelvény felirattal, markdown, léptető gombok a `shared` szabályai szerint), markdown-szerkesztő, véleményezés, döntési dialógusok, **mellékletpanel** (kép/Figma/CSV feltöltés, előnézet, `melleklet:ID` beágyazás), **rétegezett SVG kapcsolati gráf** (zoom/pan, éltípus-szűrők + jelmagyarázat, „kijelölt környezete", csomópont→kartoték, kapcsolatszerkesztés a gráfból), dev felhasználóváltó. Komponens-tesztek. |

## Üzemeltetés (éles, Fázis 7)

**Konténeres indítás** (MongoDB replica set + API + nginx-es web):

```bash
cp .env.example .env          # töltsd ki (CORS_ORIGIN, AUTH_PROVIDER, OIDC_*, …)
pnpm prod:up                  # = docker compose -f docker-compose.prod.yml up -d --build
# web: http://localhost:8080  (az /api és /dok az API-ra proxyzva)
```

A `web` nginx ugyanazon az originon szolgálja ki a SPA-t és proxyzza az `/api`-t — így nincs CORS-súrlódás.
Az API tiszta `node dist`-tel fut (nem tsx): a `@kartotek/shared` **duál csomag** — a `build` dist-re fordítja
(`exports.default`), így `node` a fordított JS-t oldja fel; fejlesztés/teszt a `development` feltétellel a forrást
használja (HMR + dist nélküli vitest/typecheck). A teljes build (`pnpm build`) topológikus: a shared épül elsőként.

**Biztonság:** minden válasz biztonsági fejléceket kap (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, éles módban `HSTS`); IP-alapú **rate limiting** (`RATE_LIMIT_MAX`/ablak,
a `/health` és `/dok` kivételével); a **CORS** éles módban allow-list (`CORS_ORIGIN`), dev-ben megengedő.
A bemenet mindenhol Zod-validált, az audit (Státusznapló) append-only.

**Hitelesítés (OIDC/SSO):** az auth-varraton (`AuthProvider`) keresztül. `AUTH_PROVIDER=oidc` esetén az
`OidcProvider` a `Bearer` tokent ellenőrzi — éles üzemhez **JWKS aláírás-validátort kell beadni** (`verifikal`,
pl. `jose`), ellenőrizetlen tokent szándékosan nem fogad el. A route-ok és service-ek változatlanok maradnak.

**Akadálymentesség (EN 301 549/WCAG):** a státusz mindig felirattal (nem csak színnel), „Ugrás a tartalomra"
skip-link, fókuszcsapda + fókusz-visszaállítás a modálokban, `aria-current` a navigációban, `:focus-visible`
körvonal, `prefers-reduced-motion` támogatás, szemantikus `header`/`main`/`aside` landmarkok.

**Mentés / visszaállítás:**

```bash
scripts/backup.sh ./mentes               # mongodump --archive --gzip
scripts/restore.sh ./mentes/kartotek-….archive.gz   # mongorestore --drop
```

A feltöltött mellékletek a `tarhely-data` kötetben vannak — azokat külön mentsd.

**E2E (Playwright):** váz a repó `e2e/` mappájában. Futtatás:

```bash
pnpm add -D -w @playwright/test && pnpm exec playwright install chromium
pnpm db:up && pnpm --filter @kartotek/api seed     # seedelt DB kell hozzá
pnpm test:e2e
```

## Nyitott pont, amit emberi döntés zár le

A Feature (`F`) és a Use Case (`TUC`) pontos szerepe a lebontási hierarchiában egyeztetendő a kollégákkal (Kiss Anna / Varga Dóra) — részletek a `docs/adatmodell.md` és a `docs/kapcsolatok.md` végén.
