# Adatmodell (MongoDB)

Ez a rendszer teljes adatmodellje **MongoDB-re, dokumentum-orientáltan** megtervezve. A domain ugyanaz, mint a prototípusban; a modellezés viszont a Mongo logikáját követi: **beágyazzuk, amit együtt olvasunk és ami egy entitáshoz tartozik** (verziók, napló, mellékletek, megjegyzések az elembe), és **külön kollekcióba tesszük, ami megosztott vagy gráfszerű** (kapcsolatok, szabályzatok, kiadások, felhasználók).

> A séma **Mongoose-megvalósítási vázlata** (TypeScript, altáblákkal és indexekkel): `docs/mongoose-sema.md`.

## Tervezési alapelvek

- **`_id` (ObjectId) a belső, változatlan azonosító.** A beszédes **`kulcs`** (`3R-FE-TUS-12`) csak megjelenített azonosító, **egyedi indexszel** — a típus- vagy rétegváltás nem töri el a hivatkozásokat.
- **A verziók az elembe ágyazva.** Egy elem összes verziója a dokumentumában él, így a kartoték **egyetlen olvasás**. A Jóváhagyott/Hatályos verzió tartalma nem módosul (lásd a vasszabályokat) — a beágyazás ezt nem gyengíti, csak gyorsítja az olvasást.
- **A kapcsolatok külön kollekció.** Az elemek közti gráf kétirányú lekérdezést és bejárást igényel; ehhez a `kapcsolatok` kollekció + a Mongo **`$graphLookup`** operátora ideális (lebontási fa bejárása, hatáselemzés, ciklusellenőrzés szerveroldalon).
- **Mindent auditálunk.** A státuszléptetés a verzióba ágyazott Státusznaplóba kerül; állami megrendelőnél az auditnyom kötelező.
- **Méretkorlát nem probléma.** Egy elem néhány verzióval, kis naplóval és pár megjegyzéssel jóval a 16 MB-os dokumentumkorlát alatt marad.

## Beágyazás vs hivatkozás — döntések

| Adat | Hol | Indok |
|---|---|---|
| Verzió | **beágyazva** az elembe (`verziok[]`) | együtt olvassuk az elemmel, az elemhez tartozik |
| Státusznapló | **beágyazva** a verzióba (`statusznaplo[]`) | a verzió append-only auditnyoma |
| Melléklet (metaadat) | **beágyazva** a verzióba (`mellekletek[]`) | a verzióhoz fagy; a fájl maga object storage-ban |
| Véleményezési megjegyzés | **beágyazva** a verzióba (`megjegyzesek[]`) | a verzió véleményezéséhez tartozik |
| Címke | **beágyazva** az elembe (`cimkek: string[]`) | egyszerű felirat; a címkelista `distinct`-tel jön |
| Tagság (szerepkör) | **beágyazva** a felhasználóba (`tagsagok[]`) | a felhasználóhoz tartozó, kis lista |
| Kapcsolat | **külön kollekció** (`kapcsolatok`) | gráf, kétirányú lekérdezés, `$graphLookup` |
| Szabályzat | **külön kollekció** (`szabalyzatok`) | megosztott, a `megfelel` kapcsolat célja |
| Kiadás (release) | **külön kollekció** (`kiadasok`) | sok verzió hivatkozhat ugyanarra |
| Szolgáltatás, Alkalmazás | **külön kollekció** | önállóan lekérdezett, az elemek hivatkoznak rájuk |
| Típus, Réteg | **referencia/konfig** (`tipusok`, `retegek`) | ritkán változó referenciaadat |

## Kollekciók

### `szolgaltatasok`
Az ernyő-szint (pl. FAIR). Csak Admin szerkeszti. **Nincs állapotgép, nincs verziózás** — tudatos döntés: csak metaadat + napló.

| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | |
| `kod` | string, **egyedi index** | pl. `FAIR` |
| `nev` | string | |
| `leiras` | string | opcionális |
| `gazdaId` | ObjectId → felhasználó | szolgáltatásgazda (pl. Nagy Péter) |

### `alkalmazasok`
Egy szolgáltatáshoz tartozik (pl. 3R, Terminus). Csak Admin szerkeszti. **Nincs állapotgép, nincs verziózás.**

| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | |
| `kod` | string, **egyedi index** | pl. `3R`, `Terminus` — ez az elem-kulcsok prefixe |
| `nev` | string | |
| `leiras` | string | opcionális |
| `szolgaltatasKod` | string → szolgáltatás | |

### `elemek`
A követelmény-kartoték. Maga az elem keret; a tartalmat és a státuszt a **beágyazott verziók** hordozzák.

| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | belső, változatlan |
| `kulcs` | string, **egyedi index** | pl. `3R-FE-TUS-12` — származtatott, beszédes |
| `tipusKod` | string → típus | `BUS, TUS, TUC, F, BD, TD` |
| `alkalmazasKod` | string → alkalmazás | |
| `retegKod` | string → réteg, nullable | **csak technikai elemnél**, üzletinél null |
| `cimkek` | string[] | beágyazott címkék |
| `verziok` | Verzió[] | **beágyazva** (lásd lent) |

#### Beágyazott: Verzió (`verziok[]`)
Egy elem egy konkrét, verziózott állapota. **Ez hordozza a tartalmat, a státuszt és a hatályossági dátumokat.**

| Mező | Típus | Megjegyzés |
|---|---|---|
| `verzioSzam` (`v`) | int | 1, 2, 3… |
| `statusz` | enum | Vázlat, Véleményezés, Jóváhagyott, Hatályos, Elavult, Archivált, Elvetve |
| `cim` | string | |
| `leirasMd` | string | markdown + Mermaid; melléklet beágyazása `![alt](melleklet:ID)` |
| `tipusMezok` | objektum | típusfüggő mezők: előfeltétel, kritérium (IB-megfelelés), CIA stb. |
| `hatalyKezdet` | date, nullable | a Jóváhagyáskor adják meg |
| `hatalyVeg` | date, nullable | üresen = „visszavonásig” |
| `kiadasIds` | ObjectId[] → kiadás | mely release-ekben szerepel |
| `letrehozva` | datetime | |
| `modositottaId` | ObjectId → felhasználó | |
| `statusznaplo` | Státusznapló[] | **beágyazva** |
| `mellekletek` | Melléklet[] | **beágyazva** |
| `megjegyzesek` | Megjegyzés[] | **beágyazva** (véleményezési visszajelzés) |

**A kartoték közös sablonja** (amit a felület egy verzióból megjelenít): ID + Verzió + Státusz · Típus · Rövid leírás és címkék · Előfeltételek · Részletes leírás (markdown) · Kritériumok (IB-megfelelés) · Kapcsolódó elemek · Audit-adatok · Státuszléptető gomb. A sablon betartatása az **eszköz** dolga (kötelező mezők, validáció), nem a felhasználói fegyelemé.

#### Beágyazott: Státusznapló (`statusznaplo[]`)
A léptetés auditnyoma (append-only).

| Mező | Típus | Megjegyzés |
|---|---|---|
| `honnan` | string | kiinduló státusz |
| `hova` | string | cél státusz |
| `mikor` | datetime | |
| `ki` | string | felhasználó azonosítója vagy `RENDSZER` (automata átmenet) |
| `indoklas` | string, opcionális | pl. visszadobásnál / jóváhagyásnál |

#### Beágyazott: Melléklet (`mellekletek[]`)
Verzióhoz fagyasztott csatolmány. Típusai: **kép**, **Figma-keret**, **CSV**.

| Mező | Típus | Megjegyzés |
|---|---|---|
| `mid` | string | a `melleklet:ID` hivatkozás ezt címzi |
| `tipus` | enum | kep, figma, csv |
| `alt` | string | beágyazási alt-szöveg |
| `tartalomHiv` | string | tárolt fájl hivatkozása (object storage / lemez) |
| `figmaPng` | string, opcionális | Figma-keretnél: fagyasztott PNG-pillanatkép hivatkozása |
| `figmaLink` | string, opcionális | Figma-keretnél: élő link; a `node-id` kettőspontja URL-kódolt (`…node-id=297%3A4125`) |

> A melléklet a verzió állapotgépe szerint **fagy**: amikor a verzió Hatályos lesz, a tartalma is befagy. A Figma-keretnél ezért a „fagyasztott pillanatkép + élő link” kettős minta — a pillanatkép a hivatkozott állapotot őrzi, a link a jelenlegit nyitja.

#### Beágyazott: Megjegyzés (`megjegyzesek[]`) — véleményezési visszajelzés
A véleményezés munka közbeni, szálazott visszajelzése. Részletek a folyamatról: `docs/velemenyezes-jovahagyas.md`.

| Mező | Típus | Megjegyzés |
|---|---|---|
| `mjid` | string | megjegyzés-azonosító (szálazáshoz) |
| `szerzoId` | ObjectId → felhasználó | a megjegyzés írója (Jóváhagyó vagy a válaszoló Szerző) |
| `szoveg` | string | |
| `horgony` | string, opcionális | szakasz/sor a leírásban, amire mutat |
| `valaszMjid` | string, opcionális | szülő megjegyzés (válasznál) |
| `allapot` | enum | nyitott, megoldott |
| `letrehozva` | datetime | |

### `kapcsolatok`
Az elemek közti irányított, tipizált él (külön kollekció). Szabályok: `docs/kapcsolatok.md`.

| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | |
| `forrasElemId` | ObjectId → elem | |
| `celElemId` | ObjectId → elem, nullable | belső cél |
| `celSzabalyzatKod` | string → szabályzat, nullable | a `megfelel` kapcsolat célja |
| `celKulsoLink` | string, nullable | a `hivatkozik` külső linkje |
| `fajta` | enum | lebontja, függ tőle, hivatkozik, megfelel, leváltja |

> A három cél-mező közül fajtánként pontosan egy van kitöltve (lásd a kapcsolat-szabályokat). **Index:** `forrasElemId`, `celElemId`, valamint összetett index a `(forrasElemId, celElemId, fajta)` egyediségre.

### `szabalyzatok`
Külső szabályzat, a `megfelel` kapcsolat célja.

| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | |
| `kod` | string, **egyedi index** | pl. `IB-XYT-14-1213` |
| `nev` | string | |
| `url` | string | |

### `kiadasok`
| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | |
| `verzio` | string, **egyedi index** | kiadásjelölő |
| `datum` | date | |

### `felhasznalok`
| Mező | Típus | Megjegyzés |
|---|---|---|
| `_id` | ObjectId | |
| `nev` | string | |
| `email` | string, **egyedi index** | |
| `tagsagok` | `{ alkalmazasKod, szerepkor }[]` | **beágyazva** — alkalmazásonkénti szerepkör |
| `globalisAdmin` | bool | rendszerszintű Admin |

`szerepkor` ∈ { Olvasó, Szerző, Jóváhagyó, Admin }. A `RENDSZER` nem valódi felhasználó (az ütemező naplóz vele). A teljes jogosultsági rendszer (mátrix, hatókör, négy-szem-elv): `docs/szerepkorok-jogosultsagok.md`.

### `tipusok`, `retegek` (referencia/konfig)
`tipusok`: `{ kod, nev, uzleti, mezoSema }` — az `uzleti` jelző dönti el, kell-e réteg. `retegek`: `{ kod, nev }`. Seedből vagy konfigból töltve.

## Dokumentum-kapcsolatok (összefoglaló)

```
szolgaltatasok ─(kod)─ alkalmazasok ─(kod)─ elemek
                                              ├─ verziok[]            (beágyazva)
                                              │    ├─ statusznaplo[]  (beágyazva)
                                              │    ├─ mellekletek[]   (beágyazva)
                                              │    └─ megjegyzesek[]  (beágyazva)
                                              └─ cimkek[]             (beágyazva)

kapcsolatok ──(forrasElemId / celElemId)── elemek          (külön kollekció, $graphLookup)
            ──(celSzabalyzatKod)────────── szabalyzatok
verziok.kiadasIds ───────────────────────  kiadasok
elemek.* műveletek ki/modositottaId ─────  felhasznalok (beágyazott tagsagok[])
```

## Azonosító-séma (kulcs) — pontos szabályok

Formátum a kolléga sémája szerint: `AlkalmazásKód-Réteg-Típus-Sorszám`, üzleti elemnél a réteg kimarad.

- **Üzleti elem** (`uzleti=true`): `AlkKód-Típus-Sorszám` → `3R-BUS-002`
- **Technikai elem** (`uzleti=false`): `AlkKód-Réteg-Típus-Sorszám` → `3R-FE-TUS-002`, `3R-Core-TUS-003`, `Terminus-TDB-TD-001`
- **Szabályzat**: saját, nem alkalmazás-prefixes kódséma (`IB-XYT-14-1213`)

A `packages/shared` ID-modulja két irányban dolgozik, és validál:
- **formáz**: `{alkKod, retegKod?, tipusKod, sorszam}` → `kulcs`
- **elemez**: `kulcs` → `{alkKod, retegKod?, tipusKod, sorszam}`
- **validál**: üzleti típushoz **nem lehet** réteg; technikaihoz **kötelező** réteg; az alkalmazás- és típuskódnak léteznie kell; a sorszám alkalmazás+típus(+réteg) szerint egyedi (a `kulcs` egyedi indexe ezt a DB-ben is kikényszeríti).

## Típusrendszer (referencia)

| Kód | Név (javaslat) | Üzleti? | Réteg? | Szerep a hierarchiában |
|---|---|---|---|---|
| `BUS` | Üzleti story | igen | nincs | a lebontási fa gyökere; mit kér az üzlet |
| `BD` | Üzleti dokumentum | igen | nincs | üzleti melléklet/dokumentum, `hivatkozik` célja |
| `F` | Feature | nem | van | **javaslat:** köztes szállítási egység BUS és TUS között (opcionális) |
| `TUC` | Use Case (technikai) | nem | van | **javaslat:** rendszerszintű technikai forgatókönyv, TUS-okra bontva (opcionális) |
| `TUS` | Technikai story | nem | van | konkrét, rétegbe sorolt megvalósítási egység |
| `TD` | Technikai dokumentum | nem | van | technikai melléklet, `hivatkozik` célja |

> ⚠️ **Egyeztetendő a kollégával (Kiss Anna / Varga Dóra):** az `F` (Feature) és `TUC` pontos szerepe a hierarchiában nyitott kérdés. A fenti a Claude-féle javaslat — mindkettő **opcionális** köztes szint, kis story-nál a BUS közvetlenül TUS-ra bontható. A nevek és az `uzleti` jelző végleges értékét a `tipusok` referenciaadatban kell rögzíteni.

> **v4 megjegyzés:** a v4 prototípus a v3-hoz képest **bővített/finomított mezőket** tartalmaz (a szerkezet — entitások, állapotok — ugyanaz). A `tipusMezok` és a kartoték-sablon konkrét mezőlistáját a seed elkészítésekor a `prototipus/kartotek-prototipus-v4.html` aktuális tartalmából kell átvenni (lásd `docs/migracio.md`).
