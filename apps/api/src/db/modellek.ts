import { Schema, model, type InferSchemaType } from 'mongoose';
import {
  STATUSZOK,
  SZEREPKOROK,
  TIPUS_KODOK,
  RETEG_KODOK,
  KAPCSOLAT_FAJTAK,
  MELLEKLET_TIPUSOK,
  MEGJEGYZES_ALLAPOTOK,
  DONTES_EREDMENYEK,
  verzioKeresoSzoveg,
} from '@kartotek/shared';
import { config } from '../config.js';

/* A Mongoose enumok a `shared` egyetlen igazságforrásából jönnek (spread, mert a
   tömbök readonly tuple-ök). Az üzleti szabályokat a service + shared kényszeríti ki. */

/* ---------- Beágyazott altáblák (verzión belül) ---------- */

const StatusznaploSchema = new Schema(
  {
    // A létrehozási bejegyzésnek nincs kiinduló státusza → opcionális.
    honnan: { type: String, enum: [...STATUSZOK] },
    hova: { type: String, enum: [...STATUSZOK], required: true },
    mikor: { type: Date, required: true, default: Date.now },
    ki: { type: String, required: true }, // felhasználó _id sztringként, vagy 'RENDSZER'
    indoklas: { type: String },
  },
  { _id: false },
);

const MellekletSchema = new Schema(
  {
    mid: { type: String, required: true },
    tipus: { type: String, enum: [...MELLEKLET_TIPUSOK], required: true },
    alt: { type: String, required: true },
    tartalomHiv: { type: String, required: true },
    mime: { type: String },
    figmaPng: { type: String },
    figmaLink: { type: String },
  },
  { _id: false },
);

const MegjegyzesSchema = new Schema(
  {
    mjid: { type: String, required: true },
    szerzoId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
    szoveg: { type: String, required: true },
    horgony: { type: String },
    valaszMjid: { type: String },
    allapot: { type: String, enum: [...MEGJEGYZES_ALLAPOTOK], required: true, default: 'nyitott' },
    letrehozva: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const JovahagyasiLepesSchema = new Schema(
  {
    lepes: { type: Number, required: true },
    szerep: { type: String, enum: [...SZEREPKOROK], required: true, default: 'Jóváhagyó' },
    kiId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
    mikor: { type: Date, required: true, default: Date.now },
    eredmeny: { type: String, enum: [...DONTES_EREDMENYEK], required: true },
  },
  { _id: false },
);

const VerzioSchema = new Schema(
  {
    verzioSzam: { type: Number, required: true },
    statusz: { type: String, enum: [...STATUSZOK], required: true, default: 'Vázlat' },
    cim: { type: String, required: true },
    leirasMd: { type: String, default: '' },
    leiras: { type: Schema.Types.Mixed, default: null }, // gazdag tartalom (TipTap JSON)
    tipusMezok: { type: Schema.Types.Mixed, default: {} }, // markModified() szükséges íráskor
    hatalyKezdet: { type: Date, default: null },
    hatalyVeg: { type: Date, default: null },
    fagyasztva: { type: Date, default: null }, // a verzió Hatályossá válásakor befagy
    kiadasIds: [{ type: Schema.Types.ObjectId, ref: 'Kiadas' }],
    letrehozva: { type: Date, required: true, default: Date.now },
    modositottaId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
    // Minden tartalom-szerkesztő (négy-szem-elv: a több-szerzős vázlat kizárása).
    szerkesztok: { type: [{ type: Schema.Types.ObjectId, ref: 'Felhasznalo' }], default: [] },
    // Tartalmi revízió: minden sikeres Vázlat-szerkesztés növeli. A kliens a szerkesztés
    // alapjául vett revíziót küldi vissza → elavult nézetből mentés 409 (nincs néma felülírás).
    revizio: { type: Number, default: 0 },
    // Származtatott, kereshető sima szöveg (gazdag leírás → szöveg + rövid leírás,
    // előfeltételek, kritériumok). A pre('validate') hook tartja naprakészen.
    keresoSzoveg: { type: String, default: '' },
    statusznaplo: { type: [StatusznaploSchema], default: [] },
    mellekletek: { type: [MellekletSchema], default: [] },
    megjegyzesek: { type: [MegjegyzesSchema], default: [] },
    jovahagyasiLepesek: { type: [JovahagyasiLepesSchema], default: [] },
  },
  { _id: false },
);

/* ---------- Kollekciók ---------- */

/** Jogi zárolás (legal hold) aktuális állapota az elemen. */
const JogiZarolasSchema = new Schema(
  {
    aktiv: { type: Boolean, required: true },
    ok: { type: String, required: true },
    kiId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
    kiNev: { type: String, default: null },
    mikor: { type: Date, required: true },
  },
  { _id: false },
);

/** A zárolás elrendelésének/feloldásának append-only története. */
const JogiZarolasNaploSchema = new Schema(
  {
    muvelet: { type: String, enum: ['elrendelés', 'feloldás'], required: true },
    ok: { type: String, required: true },
    kiId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
    kiNev: { type: String, default: null },
    mikor: { type: Date, required: true },
  },
  { _id: false },
);

const ElemSchema = new Schema(
  {
    kulcs: { type: String, required: true, unique: true },
    tipusKod: { type: String, enum: [...TIPUS_KODOK], required: true },
    alkalmazasKod: { type: String, required: true },
    retegKod: { type: String, enum: [...RETEG_KODOK], default: null },
    cimkek: { type: [String], default: [] },
    verziok: { type: [VerzioSchema], default: [] },
    jogiZarolas: { type: JogiZarolasSchema, default: null },
    jogiZarolasNaplo: { type: [JogiZarolasNaploSchema], default: [] },
  },
  // optimisticConcurrency: minden save() a __v-re szűr és növeli → két egyidejű író
  // közül a vesztes VersionError-t kap (409), sosem írja felül némán a másikat.
  { timestamps: true, optimisticConcurrency: true },
);
ElemSchema.index({ alkalmazasKod: 1, tipusKod: 1 });
ElemSchema.index({ cimkek: 1 });
// A státusz-szűrő (lista, ütemező) és a kiadás-tartalom lekérdezés indexei.
ElemSchema.index({ 'verziok.statusz': 1 });
ElemSchema.index({ 'verziok.kiadasIds': 1 });
// Teljes szövegű keresés (egy text index / kollekció): magyar szótövezés + stopszavak,
// súlyozva — a kulcs- és címtalálat előbb számít, mint egy említés a tartalomban.
ElemSchema.index(
  { kulcs: 'text', 'verziok.cim': 'text', cimkek: 'text', 'verziok.keresoSzoveg': 'text' },
  {
    name: 'teljes_szoveg',
    default_language: 'hungarian',
    weights: { kulcs: 10, 'verziok.cim': 6, cimkek: 4, 'verziok.keresoSzoveg': 1 },
  },
);

// A kereső-szöveg minden mentéskor újraszámolódik (a seed insertMany-je is validál),
// így egyetlen írási útvonal sem felejtheti el. Változatlan értéket nem ír felül,
// hogy a verzió ne jelölődjön feleslegesen módosítottnak.
ElemSchema.pre('validate', function () {
  for (const v of this.verziok) {
    const uj = verzioKeresoSzoveg(v as Parameters<typeof verzioKeresoSzoveg>[0]);
    if (v.keresoSzoveg !== uj) v.keresoSzoveg = uj;
  }
});

const KapcsolatSchema = new Schema(
  {
    forrasElemId: { type: Schema.Types.ObjectId, ref: 'Elem', required: true },
    celElemId: { type: Schema.Types.ObjectId, ref: 'Elem', default: null },
    celSzabalyzatKod: { type: String, default: null },
    celKulsoLink: { type: String, default: null },
    fajta: { type: String, enum: [...KAPCSOLAT_FAJTAK], required: true },
  },
  { timestamps: true },
);
KapcsolatSchema.index({ forrasElemId: 1 });
KapcsolatSchema.index({ celElemId: 1 });
KapcsolatSchema.index(
  { forrasElemId: 1, celElemId: 1, fajta: 1 },
  { unique: true, partialFilterExpression: { celElemId: { $type: 'objectId' } } },
);

const SzolgaltatasSchema = new Schema(
  {
    kod: { type: String, required: true, unique: true },
    nev: { type: String, required: true },
    leiras: { type: String },
    gazdaId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo' },
  },
  { timestamps: true },
);

const AlkalmazasSchema = new Schema(
  {
    kod: { type: String, required: true, unique: true },
    nev: { type: String, required: true },
    leiras: { type: String },
    szolgaltatasKod: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

const SzabalyzatSchema = new Schema({
  kod: { type: String, required: true, unique: true },
  nev: { type: String, required: true },
  url: { type: String, required: true },
});

const KiadasSchema = new Schema({
  verzio: { type: String, required: true, unique: true },
  datum: { type: Date, required: true },
});

const TagsagSchema = new Schema(
  {
    alkalmazasKod: { type: String, required: true },
    szerepkor: { type: String, enum: [...SZEREPKOROK], required: true },
  },
  { _id: false },
);

const FelhasznaloSchema = new Schema(
  {
    nev: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    tagsagok: { type: [TagsagSchema], default: [] },
    globalisAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const TipusSchema = new Schema({
  kod: { type: String, required: true, unique: true, enum: [...TIPUS_KODOK] },
  nev: { type: String, required: true },
  uzleti: { type: Boolean, required: true },
  mezoSema: { type: Schema.Types.Mixed, default: {} },
});

const RetegSchema = new Schema({
  kod: { type: String, required: true, unique: true, enum: [...RETEG_KODOK] },
  nev: { type: String, required: true },
});

const JovahagyasiLepesDefSchema = new Schema(
  {
    nev: { type: String, required: true },
    szerep: { type: String, enum: [...SZEREPKOROK], required: true, default: 'Jóváhagyó' },
  },
  { _id: false },
);

const JovahagyasiSzabalySchema = new Schema({
  alkalmazasKod: { type: String, default: null },
  tipusKod: { type: String, enum: [...TIPUS_KODOK], default: null },
  lepesek: {
    type: [JovahagyasiLepesDefSchema],
    default: () => [{ nev: 'jóváhagyás', szerep: 'Jóváhagyó' }],
  },
  kvorum: { type: Number, default: 1 },
});

/**
 * Elosztott zár az ütemezőhöz: több API-példány (vagy újraindulás) ne futtassa
 * kétszer ugyanarra a napra. A `_id` fix ('utemezo'); az atomi `utolsoFutasNap`
 * csere (findOneAndUpdate) dönti el, melyik példány végezze el aznap a futást.
 */
const UtemezoZarSchema = new Schema({
  _id: { type: String },
  utolsoFutasNap: { type: String, default: null },
  utoljaraModositva: { type: Date, default: null },
});

/**
 * Kérés-szintű audit-napló (append-only: nincs módosító/törlő végpont).
 * Ki (felhasználó-pillanatkép), honnan (IP), mit (útvonal-minta + paraméter-ID-k),
 * milyen eredménnyel. A query-string SOHA nem kerül bele (az aláírt melléklet-URL
 * `sig`-je capability-token), ahogy a kérés törzse sem (tartalom/PII).
 */
const AuditBejegyzesSchema = new Schema(
  {
    idopont: { type: Date, required: true, default: Date.now },
    esemeny: {
      type: String,
      enum: ['modositas', 'hozzaferes-megtagadva', 'olvasas'],
      required: true,
    },
    felhasznaloId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', default: null },
    email: { type: String, default: null },
    nev: { type: String, default: null },
    ip: { type: String, required: true },
    metodus: { type: String, required: true },
    utvonal: { type: String, required: true }, // route-minta, pl. /api/elemek/:id
    ut: { type: String, required: true }, // tényleges út (query nélkül)
    parameterek: { type: Schema.Types.Mixed, default: {} },
    elemId: { type: String, default: null }, // gyors szűréshez (params.id az elem-útvonalakon)
    statusz: { type: Number, required: true },
    idotartamMs: { type: Number, default: null },
  },
  { versionKey: false },
);
AuditBejegyzesSchema.index({ felhasznaloId: 1, idopont: -1 });
AuditBejegyzesSchema.index({ elemId: 1, idopont: -1 });
AuditBejegyzesSchema.index({ esemeny: 1, idopont: -1 });
// Retenció: ha be van állítva, TTL index törli a lejárt bejegyzéseket; egyébként korlátlan.
if (config.auditMegorzesNap > 0) {
  AuditBejegyzesSchema.index(
    { idopont: 1 },
    { expireAfterSeconds: Math.round(config.auditMegorzesNap * 86_400) },
  );
} else {
  AuditBejegyzesSchema.index({ idopont: -1 });
}

/* ---------- Modellek ---------- */

export const Elem = model('Elem', ElemSchema);
export const Kapcsolat = model('Kapcsolat', KapcsolatSchema);
export const Szolgaltatas = model('Szolgaltatas', SzolgaltatasSchema);
export const Alkalmazas = model('Alkalmazas', AlkalmazasSchema);
export const Szabalyzat = model('Szabalyzat', SzabalyzatSchema);
export const Kiadas = model('Kiadas', KiadasSchema);
export const Felhasznalo = model('Felhasznalo', FelhasznaloSchema);
export const Tipus = model('Tipus', TipusSchema);
export const Reteg = model('Reteg', RetegSchema);
export const JovahagyasiSzabaly = model('JovahagyasiSzabaly', JovahagyasiSzabalySchema);
/**
 * Felületi értesítés (a spec szerint az alapcsatorna; az e-mail opcionális).
 * Egy dokumentum = egy címzett egy eseményről. Rövid életű: TTL-lel törlődik
 * (a tett maga az audit-naplóban és a státusznaplóban marad meg).
 */
const ErtesitesSchema = new Schema(
  {
    cimzettId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', required: true },
    esemeny: { type: String, enum: ['bekuldes', 'jovahagyas', 'visszadobas', 'megjegyzes'], required: true },
    elemId: { type: Schema.Types.ObjectId, ref: 'Elem', required: true },
    elemKulcs: { type: String, required: true },
    verzioSzam: { type: Number, required: true },
    cim: { type: String, required: true },
    uzenet: { type: String, required: true },
    kiId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', default: null },
    kiNev: { type: String, default: null },
    letrehozva: { type: Date, required: true, default: Date.now },
    olvasva: { type: Date, default: null },
  },
  { versionKey: false },
);
ErtesitesSchema.index({ cimzettId: 1, letrehozva: -1 });
ErtesitesSchema.index({ cimzettId: 1, olvasva: 1 });
ErtesitesSchema.index(
  { letrehozva: 1 },
  { expireAfterSeconds: Math.round(Math.max(1, config.ertesitesMegorzesNap) * 86_400) },
);

/**
 * Sorszám-számláló hatókörönként (`3R|BUS|-`). Csak növekszik (atomi $inc), így egy
 * kiadott sorszám — a törölt vázlaté is — soha nem adódik ki újra.
 */
const SorszamlaloSchema = new Schema(
  {
    _id: { type: String },
    ertek: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

/**
 * Sírkő: a fizikailag törölt elem nyoma (kulcs, ki, mikor). A számláló ebből is
 * helyreállítható, és az audit-felület a törölt elem kulcsát is fel tudja oldani.
 */
const ElemSirkoSchema = new Schema(
  {
    elemId: { type: Schema.Types.ObjectId, required: true, unique: true },
    kulcs: { type: String, required: true },
    alkalmazasKod: { type: String, required: true },
    tipusKod: { type: String, required: true },
    retegKod: { type: String, default: null },
    sorszam: { type: Number, required: true },
    cim: { type: String, default: null },
    torolve: { type: Date, required: true },
    kiId: { type: Schema.Types.ObjectId, ref: 'Felhasznalo', default: null },
    kiNev: { type: String, default: null },
    /** 'törlés' (élő), vagy utólagos helyreállításnál a forrás megnevezése. */
    forras: { type: String, default: 'törlés' },
  },
  { versionKey: false },
);
ElemSirkoSchema.index({ alkalmazasKod: 1, tipusKod: 1, retegKod: 1, sorszam: -1 });

export const UtemezoZar = model('UtemezoZar', UtemezoZarSchema);
export const Sorszamlalo = model('Sorszamlalo', SorszamlaloSchema);
export const ElemSirko = model('ElemSirko', ElemSirkoSchema);
export const Ertesites = model('Ertesites', ErtesitesSchema);
export const AuditBejegyzes = model('AuditBejegyzes', AuditBejegyzesSchema);

export type ElemDoc = InferSchemaType<typeof ElemSchema>;
export type VerzioDoc = InferSchemaType<typeof VerzioSchema>;
export type KapcsolatDoc = InferSchemaType<typeof KapcsolatSchema>;
export type FelhasznaloDoc = InferSchemaType<typeof FelhasznaloSchema>;
