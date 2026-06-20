# Kartotékrendszer — projekt-kontextus Claude Code-nak

> Ez a fájl minden Claude Code-munkamenet elején automatikusan betöltődik. Röviden, naprakészen tartja a projekt lényegét. A mélységi részletek a `docs/` mappában vannak — **mindig olvasd be a feladathoz tartozó dokumentumot** munka előtt.

## Mi ez a projekt

Követelménykövető rendszer (**kartotékrendszer**) egy állami szoftvercégnek. A cél egy **működő, többfelhasználós webalkalmazás**, amelyet egy már validált, egyfájlos HTML+JS prototípusból építünk fel (`prototipus/kartotek-prototipus-v4.html`).

A prototípus a **funkcionális specifikáció és a kiinduló példaadatok forrása**. Ha egy viselkedés kérdéses, az ott látható megvalósítás az irányadó — kivéve, ahol ezek a dokumentumok kifejezetten mást írnak.

## Üzleti kontextus egy bekezdésben

A **FAIR** egy üzleti szolgáltatás (ernyő), amely alkalmazásokat fog össze. Két létező alkalmazás: **3R** (Rendezvényregisztrációs rendszer, az NFK-nak) és **Terminus** (önálló backend). Egy alkalmazás **elemekből** (követelmény-kartotékokból) áll. Az elemek **verziózottak**, az életciklusukat **állapotgép** vezérli, és **tipizált kapcsolatok** kötik össze őket — ettől lesz a rendszerből valódi traceability-eszköz, nem csak kartotékgyűjtemény.

## Architektúra (röviden)

Teljes leírás és indoklás: `docs/architektura.md`.

- **Monorepo** (pnpm workspaces): `apps/web`, `apps/api`, `packages/shared`
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Radix UI (akadálymentes primitívek), TanStack Query, react-hook-form + Zod, react-markdown + Mermaid
- **Backend:** Fastify + TypeScript, rétegezett (route → service → repository), OpenAPI (`@fastify/swagger` + Zod type provider)
- **Adatbázis:** MongoDB + Mongoose — dokumentum-orientált: a verziók (és napló/melléklet/megjegyzés) az elembe ágyazva, a kapcsolatok külön kollekció, `$graphLookup` a gráfhoz
- **Közös mag (`packages/shared`):** Zod-sémák, ID-elemző/formázó, állapotgép, kapcsolat-szabályok — tiszta függvények, a FE és a BE egyaránt használja, Vitesttel tesztelve
- **Tesztelés:** Vitest (egység + integráció), Playwright (E2E)

## Domain gyorsreferencia

Részletek: `docs/adatmodell.md`, `docs/allapotgep.md`, `docs/kapcsolatok.md`.

**Elem-azonosító (kulcs):**
- Üzleti elem: `AlkKód-Típus-Sorszám` → pl. `3R-BUS-002`
- Technikai elem: `AlkKód-Réteg-Típus-Sorszám` → pl. `3R-FE-TUS-002`, `Terminus-TDB-TD-001`
- A belső azonosító mindig egy változatlan **UUID**; a kulcs csak megjelenített, beszédes azonosító, amely típus- vagy rétegváltáskor sem törhet el hivatkozást.

**Típusok:** `BUS, TUS, TUC, F, BD, TD`
- Üzleti (réteg nélkül): **BUS** (üzleti story), **BD** (üzleti dokumentum)
- Technikai (réteggel): **TUS** (technikai story), **TUC** (use case), **F** (feature), **TD** (technikai dokumentum)

**Rétegek:** `FE, Core, TAPI, TDB`

**Állapotok:** Vázlat → Véleményezés → Jóváhagyott → Hatályos → Elavult → Archivált, plusz az Elvetve végállapot. A **Jóváhagyott→Hatályos** és a **Hatályos→Elavult** átmenetet az **ütemező** lépteti dátum alapján (a naplóban `ki = RENDSZER`).

**Kapcsolattípusok:** lebontja, függ tőle, hivatkozik, megfelel, leváltja.

**Szerepkörök:** Olvasó, Szerző, Jóváhagyó, Admin (+ RENDSZER az automata átmenetekhez). A szerepkör **alkalmazásra szabott** (pl. Kiss Anna Szerző a 3R-en, Varga Dóra a Terminuson; Nagy Péter a FAIR gazdája → Admin).

## Vasszabályok (ezeket soha ne sértsd meg)

1. **Jóváhagyott vagy Hatályos verzió tartalma nem szerkeszthető.** Módosítás kizárólag új verzió nyitásával (v+1). Amire valaha hivatkoztak, annak változatlanul visszakereshetőnek kell maradnia.
2. **Az állapotgépet a backend kényszeríti ki**, soha nem (csak) a kliens. Minden átmenet szerepkörhöz kötött, és a Státusznaplóba kerül (ki, mikor, honnan, hová).
3. **Az állapot tárolt, nem futásidőben számított.** Az ütemező lépteti dátum alapján — így auditálható és értesítés köthető hozzá.
4. **Nincs kemény törlés ott, ahol audit kell.** Törlés helyett Elvetve/Archivált végállapot. Tényleges törlés legfeljebb sosem hivatkozott Vázlatnál, függőség-ellenőrzés után.
5. **Az állapotot soha nem csak szín jelzi** — mindig kiírt felirat is kíséri (színtévesztők, EN 301 549).
6. **A `lebontja` kapcsolat ciklusmentes** kell legyen — a backend validálja. Több szülő megengedett.
7. **A szerző (és a verzió szerkesztője) nem hagyhatja jóvá a saját elemét** (négy-szem-elv) — a backend a jóváhagyásnál ellenőrzi. Részletek: `docs/velemenyezes-jovahagyas.md`.

## Archiválási szabályok

Az archiválás a tartalom **lezárásának** (nem törlésének) útja — állami környezetben az auditnyom megőrzése kötelező.

1. **Archiválni csak Elavult verziót lehet**, **Admin** jogkörrel (`Elavult → Archivált`). Hatályos verzió **nem** archiválható közvetlenül — előbb Elavultba kerül (kivezetéssel, vagy a végdátum lejártakor az ütemező lépteti).
2. **Az Archivált végállapot:** nincs továbblépés és nincs visszaléptetés. A tartalom **változatlanul, auditálhatóan megőrződik**, de a mindennapi nézetekből alapból kikerül; külön szűrővel előhozható.
3. **Verzió-szintű művelet.** Egy **elem** akkor tekinthető lezártnak, ha **minden verziója végállapotban** van (Archivált vagy Elvetve).
4. **A meglévő kapcsolatok megmaradnak** archivált elemnél is (traceability, audit); a gráf/riport jelölheti, hogy a csomópont archivált. **Új aktív kapcsolat** archivált elemmel ne jöjjön létre (különösen `lebontja` gyerek ne kerüljön archivált szülő alá).
5. **Az archiválás nem törlés.** Kemény törlés legfeljebb sosem hivatkozott Vázlatnál merülhet fel, függőség-ellenőrzés után (lásd `docs/utiterv.md`, Fázis 6); a normál lezárás útja az archiválás (vagy a Vázlat elvetése).
6. **Megőrzési idő (retenció):** ha jogszabály kötelező megőrzést ír elő, az **konfigkérdés** — a tartalom a retenciós időn belül nem távolítható el (egyeztetendő a megrendelővel).
7. **Naplózott:** minden archiválás a Státusznaplóba kerül (`ki=Admin`, mikor, `Elavult→Archivált`).

## Hogyan dolgozz ebben a repóban

- A domain-szabályokat (állapotgép, ID-logika, kapcsolatvalidáció) **a `packages/shared`-be** tedd, tiszta függvényként, és **előbb írj rá Vitest-tesztet**. Ezek a rendszer legkritikusabb logikái.
- Minden API-végpontnak legyen Zod-sémája (a `shared`-ből) → ebből jön a típusosság és az OpenAPI-dokumentáció is.
- Frontend: a `shared` szabályaival tiltsd/engedélyezd a gombokat (optimista UX), de az érdemi kényszerítés a backendé.
- Minden változás után fusson `pnpm typecheck` + `pnpm test`. A prototípus jsdom-füstteszt fegyelmét visszük tovább Vitestben.
- **Magyar a domain nyelve:** az entitás- és mezőnevek magyarul (ubiquitous language, a prototípussal konzisztensen), az általános technikai kód angolul.
- Inkrementálisan haladj: egy fázis egy témát zár le, füsttesztekkel validálva, mielőtt továbblépsz (lásd `docs/utiterv.md`).

## Hová nézz

| Téma | Fájl |
|---|---|
| Teljes adatmodell, mezők, ID-séma, típusok | `docs/adatmodell.md` |
| Állapotgép, szerepkörök, ütemező, indoklás | `docs/allapotgep.md` |
| Véleményezési és jóváhagyási folyamat | `docs/velemenyezes-jovahagyas.md` |
| Szerepkörök és jogosultságok (mátrix, négy-szem-elv) | `docs/szerepkorok-jogosultsagok.md` |
| Kapcsolattípusok és validációs szabályok | `docs/kapcsolatok.md` |
| Architektúra, stack, repo-felépítés, döntések | `docs/architektura.md` |
| **Mongoose séma vázlat** | `docs/mongoose-sema.md` |
| **Domain mag vázlat (állapotgép, jogosultság, kapcsolat, TS)** | `docs/domain-mag-vazlat.md` |
| **Részletes feladatlista / fázisos ütemterv** | `docs/utiterv.md` |
| Migráció a prototípusból, példaadat-leltár | `docs/migracio.md` |
| Indító promptok és munkamenet Claude Code-hoz | `docs/claude-code-inditas.md` |
