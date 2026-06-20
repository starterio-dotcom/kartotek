# Indítás Claude Code-dal

Ez az útmutató megmutatja, hogyan kezdj neki a fejlesztésnek ezzel a csomaggal. A lényeg: **a `CLAUDE.md` automatikusan betöltődik**, így a Claude Code már az első perctől ismeri a domaint és a szabályokat; te fázisról fázisra haladsz vele (`docs/utiterv.md`).

## Előkészületek

1. Hozz létre egy üres mappát/Git-repót, és másold bele ennek a csomagnak a teljes tartalmát (`CLAUDE.md`, `docs/`, `prototipus/`).
2. **Másold a `kartotek-prototipus-v4.html` fájlt a `prototipus/` mappába** (lásd `prototipus/OLVASS-EL.md`). Enélkül hiányoznak a pontos példaadatok a seedhez.
3. Indítsd a Claude Code-ot a repó gyökerében.

## Munkamenet (ajánlott ritmus)

- **Egy fázis egy nekifutás.** Ne kérd egyszerre az egészet — kérd a `docs/utiterv.md` szerinti következő fázist, és a végén ellenőrizd a kész-kritériumot.
- **Tervet előbb, kódot utána.** Összetett fázisnál kérj rövid tervet/lépéslistát, mielőtt írni kezd.
- **Minden lépés után fusson `pnpm typecheck` + `pnpm test`.** A prototípus füstteszt-fegyelmét visszük tovább.
- **A domain-logika a `shared`-be megy, teszttel.** Ha az állapotgépet, ID-t vagy kapcsolatvalidációt érinti a feladat, előbb a teszt.
- **A vasszabályokat tartsd be** (`CLAUDE.md` „Vasszabályok”). Ha valami feszül velük, állj meg és egyeztess.

## Indító promptok (másolható)

**0. Tájékozódás**
> Olvasd el a `CLAUDE.md`-t és a `docs/` összes fájlját. Foglald össze egy bekezdésben, hogyan értetted a projektet és az architektúrát, és jelezd, ha bármi ellentmondásos vagy hiányos a számodra.

**1. Fázis 0 — projektváz**
> Kezdjük a `docs/utiterv.md` Fázis 0-ját. Készíts pnpm-monorepót `apps/web`, `apps/api`, `packages/shared` csomagokkal a `docs/architektura.md` repo-felépítése szerint. Állítsd be a TypeScriptet (strict), ESLintet, Prettiert, Vitestet, a MongoDB-s (egy node-os replica set) `docker-compose`-t és a Mongoose-kapcsolódást, plusz egy `/health` végpontot, amit a frontend meghív. A végén igazold a Fázis 0 kész-kritériumát.

**2. Fázis 1 — adatmodell + domain mag**
> Folytasd a Fázis 1-gyel. Készítsd el a Mongoose-sémákat és indexeket a `docs/adatmodell.md` szerint (az `elemek` a verziókat — naplóval, mellékletekkel, megjegyzésekkel — beágyazva, a kapcsolatok külön kollekció), és a seedet (a példaadatokat a `prototipus/kartotek-prototipus-v4.html` `ELEMEK` tömbjéből, lásd `docs/migracio.md`). Implementáld a `packages/shared` három domain-modulját (azonosító, állapotgép, kapcsolat) tiszta függvényként, és írj rájuk Vitest-teszteket, amelyek lefedik az állapotgép minden átmenetét és a kapcsolatvalidáció minden szabályát.

**3. Egy konkrét nyitott funkció külön kérése (példa)**
> A `docs/utiterv.md` Fázis 2-ből most csak a kapcsolat CRUD-ot csináljuk meg, a `docs/kapcsolatok.md` validációival: cél-megszorítás fajtánként, ciklusellenőrzés a `lebontja`-nál, duplikátum- és önhivatkozás-tiltás, és `leváltja`-nál a cél Elavultba léptetésének felajánlása. Előbb a `shared` szabályok + tesztek, utána az API-végpontok + integráció-teszt.

**4. Véleményezési és jóváhagyási folyamat (példa)**
> Implementáld a `docs/velemenyezes-jovahagyas.md` szerinti folyamatot: beküldés (kötelező mezők validálása), véleményezési megjegyzések CRUD (szálazott, nyitott/megoldott), döntés (jóváhagyás hatálydátumokkal / visszadobás kötelező indoklással / a Szerző visszavonása), és a **négy-szem-elv** kikényszerítése a jóváhagyásnál. A jóváhagyási szabályt (policy) adatvezérelten készítsd el, hogy később kétlépcsőssé bővíthető legyen. Minden átmenet a Státusznaplóba kerüljön; írj integráció-teszteket a négy-szem-elvre és a megjegyzés-életciklusra.

## Tippek a Figma-integrációhoz (ha a Fázis 4-nél előjön)

- A Figma élő link `node-id`-ja **URL-kódolt kettősponttal** helyes: `…node-id=297%3A4125`, nem `297-4125`.
- A „fagyasztott pillanatkép + élő link” kettős minta a cél: a PNG a hivatkozott állapotot őrzi, a link a jelenlegit nyitja.
- (Prototípus-tanulság, ha automatizált Figma-exportot építenél: a nagy base64-stringek több hívásra darabolva megsérülhetnek — kisebb szélességű export a megoldás. Éles rendszerben a feltöltött/exportált fájl object storage-ba kerül.)

## Mit ne várj a Claude Code-tól külön kérés nélkül

- Ne döntsön helyetted nyitott domain-kérdésekben (pl. a Feature/TUC pontos hierarchiabeli szerepe — ezt a kollégáddal egyezteted, lásd `docs/adatmodell.md`).
- Ne lazítson a vasszabályokon (kemény törlés, jóváhagyott tartalom szerkesztése, futásidőben számolt státusz) — ha ilyenbe ütközik, jelezze és kérdezzen.
