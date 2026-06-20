# Ütemterv — a hátralévő feladatok részletesen

A prototípustól a működő alkalmazásig vezető út, **nyolc fázisra** bontva. Minden fázis egy lezárható témakör: van **célja**, **konkrét feladatlistája** és **kész-kritériuma** (mikor mehetsz tovább). A fázisok nagyjából egymásra épülnek, de a Fázis 5–6 párhuzamosítható.

Jelölés a már a prototípusban meglévő, de éles rendszerbe átültetendő funkcióknál: 🔁 *(port a prototípusból)*. A korábban kifejezetten nyitottként megjelölt két funkció: ⭐ *(eddig hiányzó / félkész)*.

---

## Fázis 0 — Projektváz és eszközök

**Cél:** futó, üres monorepo, amelyben a FE, a BE és a DB összeér, és a CI zöld.

**Feladatok**
- [ ] pnpm workspaces gyökér + `pnpm-workspace.yaml` + `tsconfig.base.json`
- [ ] `apps/web` (Vite + React + TS + Tailwind + Radix UI alap)
- [ ] `apps/api` (Fastify + TS, health-check végpont)
- [ ] `packages/shared` (üres modulok: azonosito, allapotgep, kapcsolat, semak)
- [ ] ESLint + Prettier + szigorú `tsconfig` (strict, noUncheckedIndexedAccess)
- [ ] Vitest beállítása mindhárom csomagra (a `web`-nél happy-dom/jsdom)
- [ ] `docker-compose.yml` MongoDB-vel (egy node-os **replica set**, hogy a több-dokumentumos tranzakciók működjenek); Mongoose-kapcsolódás az `apps/api/src/db`-ben
- [ ] `.env`/`.env.example` kezelés, futtatási útmutató a gyökér `README`-ben
- [ ] CI (GitHub Actions): install + lint + typecheck + test
- [ ] OpenAPI/Swagger UI bekötése a Fastifyba (üres séma is jelenjen meg)

**Kész-kritérium**
- `pnpm dev` elindítja a FE-t és a BE-t; a FE meghívja a `/health`-et és megjeleníti.
- `pnpm typecheck` és `pnpm test` zöld; a CI lefut.

---

## Fázis 1 — Adatmodell és a közös domain mag

**Cél:** a teljes adatmodell DB-ben, és a kritikus domain-logika a `shared`-ben, tesztelve. Ez a fázis hordozza a rendszer „eszét”.

**Feladatok**
- [ ] Mongoose-sémák + indexek az összes kollekcióra (`docs/adatmodell.md`, kész vázlat: `docs/mongoose-sema.md`): `elemek` (beágyazott verziók → napló, mellékletek, megjegyzések), `kapcsolatok`, `szolgaltatasok`, `alkalmazasok`, `szabalyzatok`, `kiadasok`, `felhasznalok` (beágyazott tagságok), `tipusok`, `retegek`. Egyedi index: `elemek.kulcs`, `alkalmazasok.kod`, `szabalyzatok.kod`, `felhasznalok.email`; összetett index a kapcsolat-egyediségre
- [ ] Seed-script (példaadatok a v4 prototípusból — lásd `docs/migracio.md`); a lapos `ELEMEK` → dokumentumok beágyazott verziókkal
- [ ] Referenciaadatok (Típusok az `uzleti` jelzővel, Rétegek) seedből/konfigból
- [ ] `shared/azonosito`: kulcs **formázó**, **elemző** és **validátor** (üzleti típushoz nincs réteg; technikaihoz kötelező; egyediség alkalmazás+típus[+réteg] szerint)
- [ ] `shared/allapotgep`: állapotok, megengedett átmenetek táblája, szerep-őrök, „melyik művelet melyik státuszban/szerepkörrel” (a `docs/allapotgep.md` szerint) — kész vázlat: `docs/domain-mag-vazlat.md`
- [ ] `shared/jogosultsag`: a `szabad(művelet, kontextus)` függvény + jogosultsági mátrix + négy-szem-elv (`docs/szerepkorok-jogosultsagok.md`, vázlat: `docs/domain-mag-vazlat.md`)
- [ ] `shared/kapcsolat`: kapcsolat-szabályok (cél-megszorítás fajtánként, duplikátum- és önhivatkozás-tiltás, **ciklusellenőrzés a `lebontja`-nál**) — vázlat: `docs/domain-mag-vazlat.md`
- [ ] `shared/semak`: Zod-sémák minden entitásra és a fő DTO-kra
- [ ] **Vitest-tesztek** mindhárom domain-modulra (ez a legfontosabb tesztréteg: ID-élesetek, minden átmenet + tiltott átmenetek, ciklus felismerése, cél-megszorítások)

**Kész-kritérium**
- A Mongoose-modellek és indexek létrejönnek tiszta adatbázison; a seed betölti a példaadatokat.
- A `shared` domain-tesztjei lefedik az állapotgép összes átmenetét és a kapcsolatvalidáció minden szabályát, mind zöld.

---

## Fázis 2 — Backend API, RBAC, audit, ütemező

**Cél:** teljes, típusos, dokumentált API, amely kikényszeríti az állapotgépet és a jogosultságokat, és auditál. A véleményezési-jóváhagyási folyamat (négy-szem-elv, megjegyzések, döntés + indoklás) itt készül el — részletek: `docs/velemenyezes-jovahagyas.md`.

**Feladatok**
- [ ] CRUD-végpontok: Szolgáltatás, Alkalmazás (csak Admin), Elem, Verzió
- [ ] **Státuszátmenet-végpontok**: beküldés, jóváhagyás (+ hatálydátumok), visszadobás (+ indoklás), **visszavonás** (Szerző), elvetés, új verzió nyitása, kivezetés, archiválás — mind a `shared/allapotgep` ellen validálva, **Státusznaplóba írva**
- [ ] **Beküldési validáció**: a kötelező kartoték-mezők megléte (Zod) a Vázlat→Véleményezés átmenet feltétele
- [ ] **Négy-szem-elv**: a jóváhagyás elutasul, ha a döntő felhasználó a verzió szerzője/szerkesztője
- [ ] ⭐ **Véleményezési megjegyzések CRUD**: szálazott megjegyzések a verzión (nyitott/megoldott, opcionális horgony); Szerző és Jóváhagyó is írhat — lásd `docs/velemenyezes-jovahagyas.md`
- [ ] **Jóváhagyási szabály (policy)** adatvezérelten: v1 egylépcsős; a modell készüljön fel a kétlépcsős (technikai → üzleti) / testületi bővítésre séma-átírás nélkül
- [ ] Tartalmi zár: Jóváhagyott/Hatályos verzió szerkesztése **tiltott** (csak új verzió)
- [ ] ⭐ **Kapcsolat CRUD** (felvétel/törlés) szerveroldali validációval (`shared/kapcsolat`); `leváltja`-nál a cél Elavultba léptetésének felajánlása
- [ ] Auth: session vagy JWT; **auth-provider interfész** a későbbi OIDC/SSO-hoz
- [ ] **RBAC hook**: alkalmazásra szabott hatókör (Olvasó/Szerző/Jóváhagyó/Admin), minden írási műveletnél ellenőrizve — a teljes jogosultsági mátrix és a hatókör-szabályok: `docs/szerepkorok-jogosultsagok.md`
- [ ] Lekérdezések: elemlista szűrőkkel (alkalmazás, típus, réteg, státusz, címke, keresés), elem-részlet a verziókkal + napló, kapcsolatok lekérése egy elemre
- [ ] **Ütemező job** (Jóváhagyott→Hatályos, Hatályos→Elavult): idempotens, dátumvezérelt, `RENDSZER`-naplózás; a régi Hatályos `hatalyVeg`-je az új kezdetére áll
- [ ] OpenAPI-séma minden végponton (Swagger UI-ban böngészhető)
- [ ] **Integráció-tesztek** (`mongodb-memory-server`): tipikus folyamatok + tiltott műveletek (rossz szerepkör, tiltott átmenet, ciklus, négy-szem-elv sértése) elutasítása

**Kész-kritérium**
- Egy elem végigvihető Vázlat→…→Hatályos→Elavult→Archivált úton az API-n át, helyes szerepkör-ellenőrzéssel és teljes naplóval.
- Az ütemező teszttel igazoltan lépteti az esedékes átmeneteket, kétszer futtatva sem csinál duplikátumot.
- Tiltott műveletek (jogosulatlan szerep, érvénytelen átmenet, ciklikus `lebontja`) hibával elutasítva.
- A négy-szem-elv érvényesül (a szerző nem hagyhatja jóvá a sajátját); a véleményezési megjegyzések felvehetők, megválaszolhatók és megoldottra állíthatók.

---

## Fázis 3 — Frontend: alap nézetek és a kartoték

**Cél:** a felhasználó listázni, megnyitni, szerkeszteni és léptetni tudja az elemeket — a prototípus fő képernyői élesben.

**Feladatok**
- [ ] App-váz: elrendezés, breadcrumb-navigáció, szolgáltatás/alkalmazás-választó csip-sáv 🔁, szerep-érzékeny UI
- [ ] **Elemlista** szűrőkkel és kereséssel (alkalmazás, típus, réteg, státusz, címke)
- [ ] **Elem-részlet (kartoték)** 🔁: metaadatok, **verzióválasztó**, státuszjelvény (felirat + szín), markdown-render (Mermaid + `melleklet:ID`), mellékletpanel, kapcsolatlista, Státusznapló/audit, **léptető gombok** (állapotgép, szerepkörhöz kötve, hatálydátum-dialógussal)
- [ ] **Markdown-szerkesztő** 🔁: élő előnézet, snippet-beszúró gombok (tábla, Mermaid, kódblokk, melléklet-hivatkozás)
- [ ] **Véleményezés-felület**: szálazott megjegyzések a kartotékon (nyitott/megoldott jelölés, válasz, opcionális horgony), a Szerző és a Jóváhagyó nézetével — lásd `docs/velemenyezes-jovahagyas.md`
- [ ] **Döntési dialógusok**: jóváhagyás (hatálykezdet/-vég megadása), visszadobás (kötelező indoklás), visszavonás (Szerző); a gombok elérhetősége a szerepkör és a négy-szem-elv szerint
- [ ] Szolgáltatás/alkalmazás kartoték + létrehozó/szerkesztő modálok 🔁 (csak Admin)
- [ ] TanStack Query bekötés, react-hook-form + Zod űrlapok, hiba-/töltő-/üres-állapotok
- [ ] Komponens-tesztek (Vitest) a kritikus nézetekre

**Kész-kritérium**
- Egy Szerző létre tud hozni egy elemet, megírja markdownban, beküldi; egy Jóváhagyó megjegyzést hagy, a Szerző válaszol, majd a Jóváhagyó jóváhagyja — mind a felületről, a gombok a szerepkör és a státusz szerint helyesen jelennek meg/tűnnek el.
- A státusz mindenhol felirattal is megjelenik, nem csak színnel.

---

## Fázis 4 — Mellékletek (kép, Figma, CSV)

**Cél:** a verzióhoz fagyasztott csatolmányok és a markdownba ágyazásuk élesben.

**Feladatok**
- [ ] Fájltárolás (object storage / lemez) + Melléklet-entitás végpontjai
- [ ] **Verzió-fagyasztás**: a melléklet a verzió Hatályossá válásakor befagy (lásd `docs/adatmodell.md`)
- [ ] **Kép** melléklet + bélyegkép a mellékletpanelen 🔁
- [ ] **Figma-keret** 🔁: „fagyasztott PNG-pillanatkép + élő link” kettős minta; a link `node-id`-ja URL-kódolt kettősponttal (`…node-id=297%3A4125`)
- [ ] **CSV** melléklet + táblás előnézet
- [ ] `![alt](melleklet:ID)` beágyazás a render oldalon (egyedi remark-plugin) és a szerkesztő beszúró gombján 🔁

**Kész-kritérium**
- Kép, Figma-keret és CSV is feltölthető, megjelenik a panelen és beágyazva a leírásban; Hatályossá váláskor a tartalom befagy.
- A Figma élő link helyesen nyílik (kódolt `node-id`), a pillanatkép a hivatkozott állapotot mutatja.

---

## Fázis 5 — Kapcsolati gráf nézet

**Cél:** a `lebontja`-hierarchia mentén rétegezett, élő, kattintható gráf, amelyből kapcsolatot is lehet szerkeszteni.

**Feladatok**
- [ ] A prototípus rétegezett SVG-gráfjának portolása React-komponensbe 🔁 (szintkiosztás a `docs/kapcsolatok.md` szerint)
- [ ] Éltípus szerinti szín/vonalstílus + beépített jelmagyarázat 🔁
- [ ] Típus-szűrők (éltípusonként ki/be) 🔁
- [ ] „Kijelölt környezete” hatókör (csak a kijelölt elem közvetlen szomszédsága) 🔁
- [ ] Görgetős zoom + húzható vászon 🔁; csomópontra kattintva nyíljon az elem kartotékja 🔁
- [ ] **Kapcsolatszerkesztés a gráfból** (felvétel/törlés), a Fázis 2 végpontjaira kötve, a validáció hibáit a felületen megjelenítve

**Kész-kritérium**
- A gráf a teljes adathalmazon dolgozik, szűrhető, zoomolható; csomópont-kattintásra megnyílik a kartoték.
- A gráfból felvett/törölt kapcsolat azonnal érvényesül és a szerveroldali validációnak megfelel (pl. ciklikus `lebontja` elutasítva).

---

## Fázis 6 — Törlés, függőség-őrök, riportok, release

**Cél:** biztonságos eltávolítás és a traceability gyümölcsei (riportok).

**Feladatok**
- [ ] ⭐ **Törlés függőség-őrökkel**: az állami auditelvnek megfelelően **alapból nincs kemény törlés** — hivatkozott elemnél Elvetve/Archivált a járható út; tényleges törlés legfeljebb sosem hivatkozott Vázlatnál, a bejövő/kimenő kapcsolatok ellenőrzése után. A művelet mindig megerősített és naplózott.
- [ ] **Lefedettség-riport** („mely BUS-hoz nincs még TUS?”) a `lebontja`-fa bejárásából
- [ ] **Megfelelés-riport** a `megfelel → Szabályzat` kapcsolatokból (állami megrendelőnél kemény elvárás)
- [ ] **Hatáselemzés** egy elemre (mit érint, ha változik) a `lebontja`/`függ tőle` éleken
- [ ] **Release-kezelés**: verziók kiadásokhoz rendelése, kiadás szerinti nézet

**Kész-kritérium**
- Hivatkozott elem törlése meg van akadályozva, érthető indoklással és helyette ajánlott művelettel; sosem hivatkozott vázlat eltávolítható.
- A három riport valós adatból generálódik és helyes (teszttel igazolva).

---

## Fázis 7 — Akadálymentesség, biztonság, üzemeltetés

**Cél:** állami szintű megfelelés, biztonságos üzem, telepíthetőség.

**Feladatok**
- [ ] **EN 301 549 / WCAG**: teljes billentyűzetes bejárás, fókuszkezelés, szemantikus címsor-hierarchia, képernyőolvasós ellenőrzés, kontraszt, reduced-motion, státusz mindig felirattal 🔁. (Tipp a saját receptünk szerint: ezt nem-funkcionális követelményként magában a kartotékban is vezessük, pl. `3R-BD` elem „megfelel → EN 301 549” kapcsolattal.)
- [ ] **Biztonság**: jogosultság-tesztek, bemenet-validáció mindenhol, CSRF (cookie-auth esetén), rate limiting, az audit teljessége, titokkezelés
- [ ] **Telepítés**: Dockerfile-ok, prod compose/konfiguráció, DB mentés/visszaállítás, naplózás/monitoring, környezeti konfiguráció
- [ ] **OIDC/SSO** bekötése (központi IdP / DÁP), ha releváns — az auth-provider varraton keresztül
- [ ] **E2E-készlet** (Playwright) a kritikus folyamatokra; teljesítmény-átnézés

**Kész-kritérium**
- Billentyűzettel és képernyőolvasóval végigvihető a fő folyamat; a kontraszt- és reduced-motion-ellenőrzés átmegy.
- Tiszta környezetbe telepíthető (konténerből), van mentés/visszaállítás, az E2E-készlet zöld.

---

## Sorrend és párhuzamosítás

A 0 → 1 → 2 → 3 gerincet érdemes sorban vinni (mindegyik a következő alapja). A **Fázis 4, 5 és 6** a Fázis 3 után nagyrészt párhuzamosítható (a gráf és a mellékletek függetlenek a riportoktól). A **Fázis 7** átível mindenen, de a záráshoz kötelező.

Minden fázis végén — a prototípus szokása szerint — fusson le a típusellenőrzés és a tesztek, mielőtt továbblépsz. Egy fázist akkor tekints késznek, ha a kész-kritériuma teljesül és a tesztek zöldek.
