# Architektúra

Ez a javasolt architektúra a prototípus → működő, többfelhasználós alkalmazás átálláshoz. A stack **Node.js / TypeScript**, az adatbázis **MongoDB** (megrendelői megkötések). Ahol értelmes, megnevezem az alternatívát is, hogy később könnyű legyen váltani.

## Áttekintés egy ábrán

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web  (React + Vite + TS)                                │
│  Tailwind · Radix UI · TanStack Query · react-hook-form+Zod   │
│  react-markdown + Mermaid · kapcsolati gráf (SVG)             │
└───────────────┬─────────────────────────────────────────────┘
                │  HTTP/JSON (OpenAPI)
┌───────────────▼─────────────────────────────────────────────┐
│  apps/api  (Fastify + TS)                                     │
│  route(plugin) → service(domain) → repository(Mongoose)       │
│  auth + RBAC hook · @fastify/swagger · ütemező job            │
└───────────────┬─────────────────────────────────────────────┘
                │  Mongoose
┌───────────────▼───────────┐   ┌──────────────────────────────┐
│  MongoDB                   │   │  packages/shared (TS)         │
│  elemek (beágyazott verziók)│  │  Zod-sémák · ID-logika ·      │
│  kapcsolatok ($graphLookup) │  │  állapotgép · kapcsolat-      │
│  + referencia-kollekciók   │   │  szabályok (FE+BE közös)      │
└────────────────────────────┘   └──────────────────────────────┘
```

## Stack és indoklás

### Monorepo — pnpm workspaces
Egy repo, három csomag. A **`packages/shared`** a kulcs: a domain-szabályok (ID, állapotgép, kapcsolatvalidáció) **egyszer** vannak megírva, tiszta függvényként, és a frontend is, a backend is ugyanazt importálja. Egy igazság, nincs kétszer karbantartott logika.
- *Alternatíva:* npm/yarn workspaces, Turborepo (ha build-gyorsítás kell). pnpm a default a jó disk- és cache-kezelés miatt.

### Frontend — React + Vite + TypeScript
A prototípus sok egyedi UI-t tartalmaz (modálok, markdown-szerkesztő, breadcrumb, gráf); React a természetes célpont, Vite a gyors build/dev.
- **Tailwind CSS** — modern, felhasználóbarát megjelenés, a DÁP-skin helyett (a te vizuális preferenciád szerint).
- **Radix UI** (headless, akadálymentes primitívek: dialógus, menü, tooltip) — fókuszkezelés, billentyűzet-bejárás, ARIA dobozból. Ez közvetlenül segít az **EN 301 549** megfelelésben.
- **TanStack Query** szerveroldali állapotra (cache, újratöltés), könnyű lokális állapot (Zustand vagy React context) a UI-hoz.
- **react-hook-form + Zod resolver** — a `shared` Zod-sémáit közvetlenül használja űrlapvalidációra.
- **react-markdown + remark-gfm + Mermaid**, plusz egy egyedi remark-plugin a `![alt](melleklet:ID)` beágyazáshoz.
- **Kapcsolati gráf:** a prototípus saját, rétegezett SVG-elrendezése portolva React-komponensbe — ne húzz be nehéz gráf-libet.

### Backend — Fastify + TypeScript
Könnyű, gyors, kiváló TS- és sémavalidáció-támogatás, kevesebb ceremónia, mint a NestJS — ideális egy fős + kis csapatnak. A domain-logika a `shared`-ben él, így a backend keretrendszer-független.
- Rétegezés: **route (Fastify plugin) → service (domain) → repository (Mongoose modell)**.
- **RBAC** Fastify hookkal/dekorátorral (alkalmazásra szabott hatókör).
- **OpenAPI** `@fastify/swagger` + `fastify-type-provider-zod`: a route-sémák a `shared` Zod-sémái → ebből jön a típusos route **és** az automatikus API-dokumentáció (Swagger UI).
- *Alternatíva:* **NestJS**, ha erősebb, vélemény-vezérelt struktúrát szeretnél (modulonkénti domain, DI, guard-ok). A `shared`-alapú felépítés miatt később sem drága a váltás.

### Adatbázis — MongoDB + Mongoose
A modell **dokumentum-orientált** (lásd `docs/adatmodell.md`): az `elemek` kollekció a verziókat (és azok naplóját, mellékleteit, megjegyzéseit) beágyazva tartja → a kartoték egyetlen olvasás; a `kapcsolatok` külön kollekció a gráfhoz.
- **Mongoose** ODM: sémák, indexek, middleware/hookok. A sémák a `docs/adatmodell.md` szerinti dokumentumokat tükrözik.
- **A Zod marad az igazság forrása** a domain-validációhoz és a típusokhoz: a TS-típusok a Zod-sémákból (`z.infer`) jönnek a `shared`-ben, a Mongoose pedig perzisztál. Így nincs kétféle „séma-igazság”.
- **`$graphLookup`** a `lebontja`-fa bejárásához (hatáselemzés, lefedettség, ciklusellenőrzés) — a gráflogika nagy része kiszervezhető az adatbázisba.
- **Tranzakciók:** a beágyazás-központú modellben a műveletek többsége **egyetlen dokumentumot** érint, ami atomi. A több dokumentumot érintő esetek (pl. kapcsolat felvétele + a cél Elavultba léptetése, vagy az ütemező több elemet léptet) **több-dokumentumos tranzakcióban** mennek — ehhez a MongoDB **replikahalmaz** (replica set) kell, fejlesztésben is (egy node-os replica set elég).
- *Alternatívák:* **Prisma** MongoDB-konnektorral (ha a Prisma DX-et szeretnéd, cserébe a beágyazott modellezés merevebb); **natív MongoDB driver** + Zod (a legkönnyebb réteg); **Typegoose** (TS-first Mongoose).

### Állapotgép, véleményezés/jóváhagyás és ütemező a backenden
Az állapotgép a **backend** felelőssége (a `shared` szabályaival), a kliens csak optimista UX-et ad. A véleményezési-jóváhagyási folyamat részletei: `docs/velemenyezes-jovahagyas.md` (négy-szem-elv, megjegyzések, döntés + indoklás). Az **ütemező** (Jóváhagyott→Hatályos, Hatályos→Elavult dátum alapján) éles rendszerben ütemezett job (pl. napi `node-cron` vagy külső scheduler), idempotensen, `RENDSZER`-naplózással. A prototípus `simDatum()`-ja éles `now()`-ra cserélődik.

### Mellékletek tárolása
Fájlok object storage-ban (S3-kompatibilis) vagy lemezen; a metaadat a verzióba ágyazva a DB-ben. A Figma-keret: **fagyasztott PNG** (tárolt fájl) + **élő link** (URL-kódolt `node-id`). CSV: tárolt fájl + táblás előnézet.

### Hitelesítés és SSO-varrat
Indulj **session (cookie) vagy JWT** alapú helyi hitelesítéssel + RBAC-cal. **Absztraháld egy auth-provider interfész mögé**, hogy később egy központi identitásszolgáltató (OIDC/SSO, akár DÁP/központi IdP) be tudjon csatlakozni anélkül, hogy a domain-kód változna. Állami környezetben ez jó eséllyel követelmény — egyeztetendő.

## Repo-felépítés (javasolt)

```
kartotekrendszer/
├── CLAUDE.md
├── docs/                      # ezek a tervdokumentumok
├── prototipus/
│   └── kartotek-prototipus-v4.html
├── package.json               # pnpm workspaces gyökér
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docker-compose.yml         # MongoDB (replica set, dev), később az app is
├── packages/
│   └── shared/
│       └── src/
│           ├── azonosito/     # ID-elemző, -formázó, -validátor
│           ├── allapotgep/    # állapotok, átmenetek, szerep-őrök
│           ├── kapcsolat/     # kapcsolat-szabályok, ciklusellenőrzés
│           └── semak/         # Zod-sémák (entitások, DTO-k) — az igazság forrása
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── db/            # Mongoose modellek + kapcsolódás + indexek
│   │   │   ├── seed/          # példaadatok betöltése (v4 prototípusból)
│   │   │   ├── modulok/       # elemek, verziok, kapcsolatok, velemenyezes, szolgaltatasok…
│   │   │   ├── auth/          # hitelesítés + RBAC
│   │   │   ├── utemezo/       # ütemezett átmenetek
│   │   │   └── app.ts
│   └── web/
│       └── src/
│           ├── nezet/         # lista, kartoték, gráf, véleményezés
│           ├── komponens/
│           ├── api/           # TanStack Query hookok
│           └── main.tsx
└── e2e/                       # Playwright
```

## Minőség és tesztelés
- **Vitest** egység- (a `shared` domain-logikája — ez a legmagasabb értékű) és integráció-tesztekre (API-route-ok **`mongodb-memory-server`** ellen, valós Mongo nélkül is gyorsan).
- **Playwright** E2E-re (kritikus folyamatok: elem létrehozása, verzió-életciklus, véleményezés-jóváhagyás, kapcsolat felvétele, gráf).
- A prototípus jsdom-füstteszt fegyelmét visszük tovább: minden változás után `pnpm typecheck` + `pnpm test`.
- CI (pl. GitHub Actions): lint + typecheck + test minden push-ra.

## Megjegyzés a kódnyelvről
A domain nyelve magyar (ubiquitous language, a prototípussal konzisztensen): az **entitás- és mezőnevek, a domain-resource útvonalak magyarul** (`/api/elemek`, `/api/kapcsolatok`), az általános technikai kód angolul. Ez konvenció — ha a csapat máshogy dönt, a `shared` Zod-sémái és a Mongoose-modellek a két hely, ahol a nevek élnek.
