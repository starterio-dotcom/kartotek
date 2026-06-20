# Mongoose séma — vázlat

Ez a `docs/adatmodell.md` dokumentum-modelljének Mongoose-megvalósítási **vázlata**. A fájlok az `apps/api/src/db/` alá kerülnek. A séma az **alakot és az indexeket** rögzíti; az **üzleti szabályokat** (állapotátmenetek, négy-szem-elv, kapcsolat-validáció, réteg/típus konzisztencia, ciklusmentesség) a `packages/shared` és a service-réteg kényszeríti ki — nem a séma.

## Konvenciók

- **A Zod marad az igazság forrása.** A literál-uniókat (státuszok, szerepkörök, típusok…) a `packages/shared` exportálja **egyetlen** `as const` tömbként; ezt importálja a Zod is és a Mongoose `enum` is. Így nincs kétféle igazság. (Lent a tömbök a teljesség kedvéért itt szerepelnek — élesben a `shared`-ből jöjjenek.)
- **`_id: false` az értékobjektum-altáblákon.** A beágyazott altáblák saját üzleti kulcsot kapnak (`verzioSzam`, `mid`, `mjid`), nem Mongoose-`_id`-t.
- **`Schema.Types.Mixed` a típusfüggő mezőkre** (`tipusMezok`, `mezoSema`). Figyelem: a Mixed nem követi automatikusan a változást — módosításkor `doc.markModified('tipusMezok')` kell.
- **Tranzakciók:** a több-dokumentumos műveletekhez (pl. kapcsolat felvétele + cél Elavultba léptetése, ütemező) MongoDB **replica set** kell, fejlesztésben is.

## Felsorolások (élesben a `shared`-ből)

```ts
export const STATUSZOK = [
  'Vázlat', 'Véleményezés', 'Jóváhagyott', 'Hatályos', 'Elavult', 'Archivált', 'Elvetve',
] as const;
export const SZEREPKOROK = ['Olvasó', 'Szerző', 'Jóváhagyó', 'Admin'] as const;
export const TIPUS_KODOK = ['BUS', 'TUS', 'TUC', 'F', 'BD', 'TD'] as const;
export const RETEG_KODOK = ['FE', 'Core', 'TAPI', 'TDB'] as const;
export const KAPCSOLAT_FAJTAK = ['lebontja', 'függ tőle', 'hivatkozik', 'megfelel', 'leváltja'] as const;
export const MELLEKLET_TIPUSOK = ['kep', 'figma', 'csv'] as const;
export const MEGJEGYZES_ALLAPOTOK = ['nyitott', 'megoldott'] as const;
export const DONTES_EREDMENYEK = ['jóváhagyva', 'visszadobva'] as const;
```

## Beágyazott altáblák (verzión belül)

```ts
import { Schema, model, InferSchemaType } from 'mongoose';

/** Egy állapotátmenet auditnyoma (append-only). */
const StatusznaploSchema = new Schema({
  honnan:   { type: String, enum: STATUSZOK, required: true },
  hova:     { type: String, enum: STATUSZOK, required: true },
  mikor:    { type: Date,   required: true, default: Date.now },
  ki:       { type: String, required: true },      // felhasználó _id sztringként, vagy 'RENDSZER'
  indoklas: { type: String },                      // pl. visszadobásnál / jóváhagyásnál
}, { _id: false });

/** Verzióhoz fagyasztott melléklet metaadata (a fájl object storage-ban). */
const MellekletSchema = new Schema({
  mid:        { type: String, required: true },    // a `![alt](melleklet:ID)` ezt címzi
  tipus:      { type: String, enum: MELLEKLET_TIPUSOK, required: true },
  alt:        { type: String, required: true },
  tartalomHiv:{ type: String, required: true },    // tárolt fájl hivatkozása
  figmaPng:   { type: String },                    // Figma-keretnél: fagyasztott pillanatkép
  figmaLink:  { type: String },                    // Figma-keretnél: élő link (node-id URL-kódolt)
}, { _id: false });

/** Véleményezési megjegyzés (szálazott). */
const MegjegyzesSchema = new Schema({
  mjid:      { type: String, required: true },
  szerzoId:  { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
  szoveg:    { type: String, required: true },
  horgony:   { type: String },                     // szakasz/sor a leírásban
  valaszMjid:{ type: String },                      // szülő megjegyzés (válasznál)
  allapot:   { type: String, enum: MEGJEGYZES_ALLAPOTOK, required: true, default: 'nyitott' },
  letrehozva:{ type: Date,   required: true, default: Date.now },
}, { _id: false });

/** Egy jóváhagyási lépés eredménye (többlépcsős/testületi jóváhagyáshoz; v1: egy lépés). */
const JovahagyasiLepesSchema = new Schema({
  lepes:    { type: Number, required: true },       // hányadik lépés
  szerep:   { type: String, enum: SZEREPKOROK, required: true, default: 'Jóváhagyó' },
  kiId:     { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
  mikor:    { type: Date,   required: true, default: Date.now },
  eredmeny: { type: String, enum: DONTES_EREDMENYEK, required: true },
}, { _id: false });

/** Egy elem egy verziója — ez hordozza a tartalmat, státuszt, hatályosságot. */
const VerzioSchema = new Schema({
  verzioSzam:    { type: Number, required: true },                 // 1, 2, 3…
  statusz:       { type: String, enum: STATUSZOK, required: true, default: 'Vázlat' },
  cim:           { type: String, required: true },
  leirasMd:      { type: String, default: '' },                    // markdown + Mermaid + melleklet:ID
  tipusMezok:    { type: Schema.Types.Mixed, default: {} },        // előfeltétel, kritérium, CIA… (markModified!)
  hatalyKezdet:  { type: Date, default: null },
  hatalyVeg:     { type: Date, default: null },                    // null = visszavonásig
  kiadasIds:     [{ type: Schema.Types.ObjectId, ref: 'Kiadas' }],
  letrehozva:    { type: Date, required: true, default: Date.now },
  modositottaId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
  statusznaplo:  { type: [StatusznaploSchema],     default: [] },
  mellekletek:   { type: [MellekletSchema],        default: [] },
  megjegyzesek:  { type: [MegjegyzesSchema],       default: [] },
  jovahagyasiLepesek: { type: [JovahagyasiLepesSchema], default: [] },
}, { _id: false });
```

## Kollekciók

```ts
/** elemek — a kartoték; a verziók beágyazva. */
const ElemSchema = new Schema({
  kulcs:         { type: String, required: true, unique: true },   // pl. 3R-FE-TUS-12
  tipusKod:      { type: String, enum: TIPUS_KODOK, required: true },
  alkalmazasKod: { type: String, required: true },
  retegKod:      { type: String, enum: RETEG_KODOK, default: null },// csak technikai elemnél
  cimkek:        { type: [String], default: [] },
  verziok:       { type: [VerzioSchema], default: [] },
}, { timestamps: true });

ElemSchema.index({ alkalmazasKod: 1, tipusKod: 1 });
ElemSchema.index({ cimkek: 1 });

// Üzleti szabály (réteg/típus konzisztencia) — a shared validátorral:
// ElemSchema.pre('validate', function (next) {
//   const hiba = ellenorizKulcs(this.kulcs, this.tipusKod, this.retegKod); // packages/shared
//   return hiba ? next(new Error(hiba)) : next();
// });

export const Elem = model('Elem', ElemSchema);


/** kapcsolatok — az elemek közti tipizált él (külön kollekció, $graphLookup). */
const KapcsolatSchema = new Schema({
  forrasElemId:     { type: Schema.Types.ObjectId, ref: 'Elem', required: true },
  celElemId:        { type: Schema.Types.ObjectId, ref: 'Elem', default: null },
  celSzabalyzatKod: { type: String, default: null },               // `megfelel` célja
  celKulsoLink:     { type: String, default: null },               // `hivatkozik` külső linkje
  fajta:            { type: String, enum: KAPCSOLAT_FAJTAK, required: true },
}, { timestamps: true });

KapcsolatSchema.index({ forrasElemId: 1 });
KapcsolatSchema.index({ celElemId: 1 });
// Egyediség az elem-célú kapcsolatokra (partial, mert a cél polimorf):
KapcsolatSchema.index(
  { forrasElemId: 1, celElemId: 1, fajta: 1 },
  { unique: true, partialFilterExpression: { celElemId: { $type: 'objectId' } } },
);
// Cél-megszorítás (pontosan egy cél-mező fajtánként), ciklusmentesség és duplikátum-tiltás:
// a service + packages/shared/kapcsolat felelőssége (lásd docs/kapcsolatok.md).

export const Kapcsolat = model('Kapcsolat', KapcsolatSchema);


/** szolgaltatasok / alkalmazasok — Admin szerkeszti, nincs állapotgép. */
const SzolgaltatasSchema = new Schema({
  kod:     { type: String, required: true, unique: true },         // pl. FAIR
  nev:     { type: String, required: true },
  leiras:  { type: String },
  gazdaId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo' },
}, { timestamps: true });
export const Szolgaltatas = model('Szolgaltatas', SzolgaltatasSchema);

const AlkalmazasSchema = new Schema({
  kod:             { type: String, required: true, unique: true }, // pl. 3R, Terminus
  nev:             { type: String, required: true },
  leiras:          { type: String },
  szolgaltatasKod: { type: String, required: true, index: true },
}, { timestamps: true });
export const Alkalmazas = model('Alkalmazas', AlkalmazasSchema);


/** szabalyzatok / kiadasok — referencia-entitások. */
const SzabalyzatSchema = new Schema({
  kod: { type: String, required: true, unique: true },             // pl. IB-XYT-14-1213
  nev: { type: String, required: true },
  url: { type: String, required: true },
});
export const Szabalyzat = model('Szabalyzat', SzabalyzatSchema);

const KiadasSchema = new Schema({
  verzio: { type: String, required: true, unique: true },
  datum:  { type: Date,   required: true },
});
export const Kiadas = model('Kiadas', KiadasSchema);


/** felhasznalok — a tagságok (alkalmazásonkénti szerepkör) beágyazva. */
const TagsagSchema = new Schema({
  alkalmazasKod: { type: String, required: true },
  szerepkor:     { type: String, enum: SZEREPKOROK, required: true },
}, { _id: false });

const FelhasznaloSchema = new Schema({
  nev:           { type: String, required: true },
  email:         { type: String, required: true, unique: true },
  tagsagok:      { type: [TagsagSchema], default: [] },
  globalisAdmin: { type: Boolean, default: false },
}, { timestamps: true });
export const Felhasznalo = model('Felhasznalo', FelhasznaloSchema);


/** tipusok / retegek — ritkán változó referenciaadat (seedből/konfigból). */
const TipusSchema = new Schema({
  kod:      { type: String, required: true, unique: true, enum: TIPUS_KODOK },
  nev:      { type: String, required: true },
  uzleti:   { type: Boolean, required: true },                     // true → réteg nélkül
  mezoSema: { type: Schema.Types.Mixed, default: {} },             // típusfüggő mezők sémája
});
export const Tipus = model('Tipus', TipusSchema);

const RetegSchema = new Schema({
  kod: { type: String, required: true, unique: true, enum: RETEG_KODOK },
  nev: { type: String, required: true },
});
export const Reteg = model('Reteg', RetegSchema);


/** jovahagyasi_szabalyok — adatvezérelt jóváhagyási policy (v1: egylépcsős). */
const JovahagyasiLepesDefSchema = new Schema({
  nev:    { type: String, required: true },                        // pl. 'technikai', 'üzleti'
  szerep: { type: String, enum: SZEREPKOROK, required: true, default: 'Jóváhagyó' },
}, { _id: false });

const JovahagyasiSzabalySchema = new Schema({
  alkalmazasKod: { type: String, default: null },                  // null = globális alapértelmezés
  tipusKod:      { type: String, enum: TIPUS_KODOK, default: null },// null = minden típus
  lepesek:       { type: [JovahagyasiLepesDefSchema],
                   default: () => ([{ nev: 'jóváhagyás', szerep: 'Jóváhagyó' }]) }, // v1: egy lépés
  kvorum:        { type: Number, default: 1 },                     // testületi jóváhagyáshoz
});
export const JovahagyasiSzabaly = model('JovahagyasiSzabaly', JovahagyasiSzabalySchema);
```

## Típusok a sémából

```ts
export type ElemDoc        = InferSchemaType<typeof ElemSchema>;
export type VerzioDoc      = InferSchemaType<typeof VerzioSchema>;
export type KapcsolatDoc   = InferSchemaType<typeof KapcsolatSchema>;
export type FelhasznaloDoc = InferSchemaType<typeof FelhasznaloSchema>;
// …és így tovább. Ideálisan ezek illeszkednek a packages/shared Zod-típusaihoz (z.infer):
// a literál-uniók és a DTO-alakok a shared-ből jönnek, a Mongoose-modell csak perzisztál.
```

## Mit hagyunk a service / shared rétegre (nem a sémába)

- **Állapotátmenetek** és a hozzájuk tartozó naplóírás (`shared/allapotgep`).
- **Négy-szem-elv** a jóváhagyásnál (a döntő felhasználó ≠ a verzió szerzője/szerkesztője) — lásd `docs/velemenyezes-jovahagyas.md`.
- **Kapcsolat-validáció**: cél-megszorítás fajtánként, ciklusmentesség (`lebontja`), duplikátum- és önhivatkozás-tiltás (`shared/kapcsolat`).
- **Réteg/típus konzisztencia** és a kulcs egyedisége (`shared/azonosito` + a `kulcs` egyedi indexe).
- **Tartalmi zár**: Jóváhagyott/Hatályos verzió nem szerkeszthető — a service utasítja el.
- **Jogosultság**: a hozzáférés-ellenőrzés a `shared` jogosultság-függvényével és a backend RBAC hookkal (lásd `docs/szerepkorok-jogosultsagok.md`).
