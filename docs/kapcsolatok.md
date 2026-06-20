# Kapcsolattípusok és validáció

Az elemeket **irányított, tipizált kapcsolatok** kötik össze. Ez váltja le az egyszerű linklistát, és ettől lesz a rendszer valódi traceability-eszköz (hatáselemzés, lefedettség- és megfelelés-riport). Öt kapcsolattípus van; mindegyiknek saját iránya, célmegszorítása és validációs szabálya van.

## Az öt kapcsolattípus

| Fajta | Irány | Célmegszorítás | Mire jó |
|---|---|---|---|
| **lebontja** | szülő → gyerek | bármely elem | a hierarchia gerince; hatáselemzés és lefedettség alapja |
| **függ tőle** | bármely → bármely | bármely elem | megvalósítási sorrend és kockázat (főleg technikai elemek közt) |
| **hivatkozik** | bármely → BD/TD vagy külső link | dokumentum vagy külső hivatkozás | informális, gyenge kapcsolat |
| **megfelel** | bármely → Szabályzat | **kizárólag szabályzat-elem** | compliance-riport (állami megrendelőnél kemény elvárás) |
| **leváltja** | azonos típusú → azonos típusú | azonos típusú elem | kivezetés követése; itt ér össze a kapcsolatmodell az állapotgéppel |

## Részletek és szabályok

### lebontja (a hierarchia gerince)
- **Ciklusmentesnek kell lennie** — a backend validálja (új él beszúrása előtt ellenőrizd, hogy nem keletkezik kör).
- **Több szülő megengedett** (egy elem több lebontási ágban is szerepelhet).
- Ebből jön a lefedettség-riport („mely BUS-hoz nincs még TUS?”) és a hatáselemzés (a fa felfelé/lefelé bejárásával). A „mi érintett, ha X változik?” kérdés automatikusan megválaszolható, nem kell külön karbantartani.
- Tipikus lánc: `FIGMA terv ⇢(hivatkozik) BUS → F/TUC → TUS → BD/TD ⇢(megfelel) Szabályzat`.

### függ tőle
- Megvalósítási sorrendiség és kockázat jelölése, jellemzően technikai elemek között.

### hivatkozik
- Informális, gyenge kapcsolat — pl. a regisztrációs BUS hivatkozik a regisztrációs űrlap dokumentumra (BD), vagy egy külső linkre.

### megfelel
- A cél **csak Szabályzat-elem lehet** (pl. `IB-XYT-14-1213`). Ebből generálható a megfelelés-riport.
- Példa a saját rendszerünk „receptje” szerint: az akadálymentességi nem-funkcionális követelmény egy `3R-BD` elemként, „megfelel → EN 301 549” kapcsolattal.

### leváltja
- **Csak azonos típusú elemek között.**
- A kapcsolat létrejöttekor a rendszer **felajánlja a cél elem Elavultba léptetését** — ez a kapcsolatmodell és az állapotgép találkozási pontja (lásd `docs/allapotgep.md`).

## Validáció (a `packages/shared`-ben, a backend kényszeríti ki)

Új kapcsolat felvételekor ellenőrizd:

1. **Cél-megszorítás** a fajta szerint (lásd a táblázat „Célmegszorítás” oszlopát) — pl. `megfelel` célja kötelezően Szabályzat; `leváltja` forrása és célja azonos típusú.
2. **Ciklusmentesség** a `lebontja` fajtánál (a tranzitív lezárt nem tartalmazhat kört).
3. **Nincs duplikátum** (ugyanaz a forrás–cél–fajta hármas csak egyszer).
4. **Önhivatkozás tiltása** (forrás ≠ cél).
5. **`leváltja` esetén** a művelet után ajánld fel a cél Elavultba léptetését (külön, megerősített akció).

> Ezeknek a szabályoknak a konkrét TypeScript-vázlata (`kapcsolatValidacio`, célfajta-ellenőrzés, `lebontja` ciklusvizsgálat): `docs/domain-mag-vazlat.md`.

## Megjelenítés a kapcsolati gráfban

A gráf rétegzett elrendezésű a `lebontja`-hierarchia mentén (BUS felül → F/TUC → TUS → dokumentumok → szabályzatok). A szint-hozzárendelés a prototípusban:

```
BUS: 0   |   F: 1, TUC: 1   |   TUS: 2   |   BD: 3, TD: 3   |   Szabályzat: 4
```

A `lebontja` élek garantáltan lefelé mutatnak (a gyerek mindig mélyebb szinten van a szülőnél). Éltípusonkénti stílus (a korábban auditált, 3:1 feletti kontrasztú színekből):

| Fajta | Szín | Vonal |
|---|---|---|
| lebontja | `#4258ED` | folytonos, 2px |
| függ tőle | `#A65200` | szaggatott (7 4), 2px |
| hivatkozik | `#5C6677` | pontozott (2 5), 2px |
| megfelel | `#065E90` | hosszú szaggatott (11 4), 2px |
| leváltja | `#D6220F` | folytonos, 2.6px (vastag) |

A gráfról bővebben: a `docs/utiterv.md` Fázis 5 része. A jelmagyarázat a felületen is megjelenik (a gráf alatti sávban), nem csak a kódban.

## Nyitott kérdés (egyeztetendő)

A `lebontja` célpontjainál a tervezési javaslat szerint a Feature (`F`) és a Use Case (`TUC`) **opcionális köztes szintek** a BUS és a TUS között. A pontos megengedett (forrás-típus → cél-típus) mátrixot a `lebontja` fajtára érdemes a kollégával véglegesíteni, és a `shared` kapcsolat-szabály moduljában adatvezérelten (nem hardkódolva) rögzíteni.
