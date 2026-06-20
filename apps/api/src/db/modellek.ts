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
} from '@kartotek/shared';

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
    statusznaplo: { type: [StatusznaploSchema], default: [] },
    mellekletek: { type: [MellekletSchema], default: [] },
    megjegyzesek: { type: [MegjegyzesSchema], default: [] },
    jovahagyasiLepesek: { type: [JovahagyasiLepesSchema], default: [] },
  },
  { _id: false },
);

/* ---------- Kollekciók ---------- */

const ElemSchema = new Schema(
  {
    kulcs: { type: String, required: true, unique: true },
    tipusKod: { type: String, enum: [...TIPUS_KODOK], required: true },
    alkalmazasKod: { type: String, required: true },
    retegKod: { type: String, enum: [...RETEG_KODOK], default: null },
    cimkek: { type: [String], default: [] },
    verziok: { type: [VerzioSchema], default: [] },
  },
  { timestamps: true },
);
ElemSchema.index({ alkalmazasKod: 1, tipusKod: 1 });
ElemSchema.index({ cimkek: 1 });

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

export type ElemDoc = InferSchemaType<typeof ElemSchema>;
export type VerzioDoc = InferSchemaType<typeof VerzioSchema>;
export type KapcsolatDoc = InferSchemaType<typeof KapcsolatSchema>;
export type FelhasznaloDoc = InferSchemaType<typeof FelhasznaloSchema>;
