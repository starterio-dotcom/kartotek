# Migráció a prototípusból

A prototípus (`prototipus/kartotek-prototipus-v4.html`) nem eldobandó: ez a **funkcionális specifikáció és a kiinduló példaadatok forrása**. A migráció lényege nem újraírás, hanem **a már bevált logika kiemelése** a megfelelő helyre.

## Stratégia négy lépésben

1. **Domain-szabályok kiemelése a `packages/shared`-be.** Az állapotgép (`lephetMenu`, `muvelet`, `utemezoFut`), a kapcsolatvalidáció és az ID-logika (`alkOf`) a prototípusban már működik JS-ben — ezt portoljuk TS-be, tiszta függvényként, **tesztekkel** (lásd `docs/utiterv.md`, Fázis 1). A `simDatum()` éles `now()`-ra cserélődik.
2. **Példaadatok kinyerése seed-scriptbe.** A prototípus `SZOLGALTATAS`, `ALKALMAZASOK`, `ELEMEK` (és a beágyazott verziók, kapcsolatok, mellékletek, szabályzatok) struktúrái → seed-script, amit a Mongoose tölt be. A lapos `ELEMEK` listából **dokumentumok lesznek beágyazott verziókkal** (a verzióba ágyazott naplóval, mellékletekkel, megjegyzésekkel), a kapcsolatok pedig a külön `kapcsolatok` kollekcióba kerülnek — lásd `docs/adatmodell.md`. Így az új rendszer ugyanazzal a demo-tartalommal indul, és az E2E-tesztek valós példákon futnak.
3. **UI újraépítése komponensenként.** A prototípus markupja és CSS-e **referencia** a React-komponensekhez — a kinézet és az interakciók adottak, „csak” komponensekre kell bontani. A markdown-szerkesztő és a kartoték-elrendezés szinte 1:1 átültethető.
4. **A gráf portolása.** A rétegezett SVG-elrendezés matematikája (szintkiosztás, élrajzolás, stílusok) közvetlenül újrahasznosítható egy React-gráfkomponensben (Fázis 5).

## Mit őriz meg a prototípus, amire figyelni kell

- A **kulcs** csak megjelenített azonosító; az éles modellben az elem belső kulcsa UUID (a prototípus kulcs-alapú indexelése `elemByKulcs` helyett UUID-alapú lesz, de a kulcs továbbra is egyedi és kereshető).
- A **fagyasztási szabály**: Jóváhagyott/Hatályos verzió és a hozzá fagyott melléklet tartalma nem változik.
- A **státusz tárolt**, az ütemező lépteti — ne számítsd futásidőben.
- **Akadálymentesség**: a prototípusban már van látható fókuszgyűrű (≈3,64:1 kontraszt), reduced-motion-támogatás és némi ARIA — ezt éles szinten teljes billentyűzet-bejárásig, szemantikus címsorokig és képernyőolvasós ellenőrzésig kell vinni (Fázis 7).

## Példaadat-leltár (a prototípus seedje)

A prototípus kb. **10 elemet és ~10 kapcsolatot** tartalmaz. A fő, név szerint ismert tartalmak, amelyeket a seedbe érdemes átvinni:

- **Szolgáltatás:** FAIR
- **Alkalmazások:** 3R (Rendezvényregisztrációs rendszer, NFK), Terminus (önálló backend)
- **Kiemelt elem:** `3R-BUS-002` „Regisztráció” — két verzióval: **v1 Hatályos** (befagyott), **v2 Vázlat**. A v2-be be van ágyazva egy valódi Figma-pillanatkép a 3R Figma-fájlból (frame „Regisztrációs űrlap”, node `297:4125`), a „fagyasztott PNG + élő link” minta szerint.
- **Technikai elemek** példái: `3R-FE-TUS-002`, `3R-Core-TUS-003`, `3R-TUC-001`, `Terminus-TDB-TD-001`
- **Szabályzat:** `IB-XYT-14-1213` (a `megfelel` kapcsolat célpéldája)
- **Felhasználók/szerepek a demóhoz:** Kiss Anna (Szerző, 3R), Varga Dóra (Szerző, Terminus), Nagy Péter (FAIR-gazda, Admin)

> A pontos mezőértékeket a `prototipus/kartotek-prototipus-v4.html` `ELEMEK` tömbjéből kell kiolvasni a seed elkészítésekor — ezért fontos, hogy a fájl bekerüljön a `prototipus/` mappába (lásd `prototipus/OLVASS-EL.md`).

## Egy tudatosan örökölt hiányosság, amit az eszköznek kezelnie kell

A prototípus `3R-BUS-002` példája szándékosan **eltér a sablontól** (hiányzó státusz/verzió/előfeltételek, hibás lépésszámozás). Ez jól mutatja a tanulságot: a **sablon betartatása az eszköz dolga** (kötelező mezők, validáció), nem a felhasználói fegyelemé. Az éles rendszerben tehát a verzió-űrlap validálja a kötelező mezőket, mielőtt egy elem továbbléphet Véleményezésre.
