import { z } from 'zod';
import {
  StatuszSchema,
  SzerepkorSchema,
  TipusKodSchema,
  RetegKodSchema,
  KapcsolatFajtaSchema,
  MellekletTipusSchema,
  MegjegyzesAllapotSchema,
  DontesEredmenySchema,
} from './enums.js';

/** Az ObjectId/UUID a wire-on string. */
export const IdSchema = z.string().min(1);

/* ---------- Beágyazott altáblák (verzión belül) ---------- */

export const StatusznaploSchema = z.object({
  // A létrehozási bejegyzésnek nincs kiinduló státusza → opcionális.
  honnan: StatuszSchema.optional(),
  hova: StatuszSchema,
  mikor: z.coerce.date(),
  ki: z.string().min(1), // felhasználó id vagy 'RENDSZER'
  indoklas: z.string().optional(),
});

export const MellekletSchema = z.object({
  mid: z.string().min(1),
  tipus: MellekletTipusSchema,
  alt: z.string(),
  tartalomHiv: z.string().min(1),
  mime: z.string().optional(),
  figmaPng: z.string().optional(),
  figmaLink: z.string().optional(),
});

export const MegjegyzesSchema = z.object({
  mjid: z.string().min(1),
  szerzoId: IdSchema,
  szoveg: z.string().min(1),
  horgony: z.string().optional(),
  valaszMjid: z.string().optional(),
  allapot: MegjegyzesAllapotSchema.default('nyitott'),
  letrehozva: z.coerce.date(),
});

export const JovahagyasiLepesSchema = z.object({
  lepes: z.number().int().positive(),
  szerep: SzerepkorSchema.default('Jóváhagyó'),
  kiId: IdSchema,
  mikor: z.coerce.date(),
  eredmeny: DontesEredmenySchema,
});

export const VerzioSchema = z.object({
  verzioSzam: z.number().int().positive(),
  statusz: StatuszSchema.default('Vázlat'),
  cim: z.string().min(1),
  leirasMd: z.string().default(''),
  /** Gazdag tartalom (TipTap/ProseMirror JSON). Ha üres, a `leirasMd` a forrás (régi/seed). */
  leiras: z.unknown().optional(),
  tipusMezok: z.record(z.unknown()).default({}),
  hatalyKezdet: z.coerce.date().nullable().default(null),
  hatalyVeg: z.coerce.date().nullable().default(null),
  fagyasztva: z.coerce.date().nullable().default(null),
  kiadasIds: z.array(IdSchema).default([]),
  letrehozva: z.coerce.date(),
  modositottaId: IdSchema,
  statusznaplo: z.array(StatusznaploSchema).default([]),
  mellekletek: z.array(MellekletSchema).default([]),
  megjegyzesek: z.array(MegjegyzesSchema).default([]),
  jovahagyasiLepesek: z.array(JovahagyasiLepesSchema).default([]),
});

/* ---------- Kollekciók ---------- */

export const ElemSchema = z.object({
  id: IdSchema.optional(),
  kulcs: z.string().min(1),
  tipusKod: TipusKodSchema,
  alkalmazasKod: z.string().min(1),
  retegKod: RetegKodSchema.nullable().default(null),
  cimkek: z.array(z.string()).default([]),
  verziok: z.array(VerzioSchema).default([]),
});

export const KapcsolatSchema = z.object({
  id: IdSchema.optional(),
  forrasElemId: IdSchema,
  celElemId: IdSchema.nullable().default(null),
  celSzabalyzatKod: z.string().nullable().default(null),
  celKulsoLink: z.string().url().nullable().default(null),
  fajta: KapcsolatFajtaSchema,
});

export const SzolgaltatasSchema = z.object({
  id: IdSchema.optional(),
  kod: z.string().min(1),
  nev: z.string().min(1),
  leiras: z.string().optional(),
  gazdaId: IdSchema.optional(),
});

export const AlkalmazasSchema = z.object({
  id: IdSchema.optional(),
  kod: z.string().min(1),
  nev: z.string().min(1),
  leiras: z.string().optional(),
  szolgaltatasKod: z.string().min(1),
});

export const SzabalyzatSchema = z.object({
  id: IdSchema.optional(),
  kod: z.string().min(1),
  nev: z.string().min(1),
  url: z.string().url(),
});

export const KiadasSchema = z.object({
  id: IdSchema.optional(),
  verzio: z.string().min(1),
  datum: z.coerce.date(),
});

export const TagsagSchema = z.object({
  alkalmazasKod: z.string().min(1),
  szerepkor: SzerepkorSchema,
});

export const FelhasznaloSchema = z.object({
  id: IdSchema.optional(),
  nev: z.string().min(1),
  email: z.string().email(),
  tagsagok: z.array(TagsagSchema).default([]),
  globalisAdmin: z.boolean().default(false),
});

export const TipusSchema = z.object({
  kod: TipusKodSchema,
  nev: z.string().min(1),
  uzleti: z.boolean(),
  mezoSema: z.record(z.unknown()).default({}),
});

export const RetegSchema = z.object({
  kod: RetegKodSchema,
  nev: z.string().min(1),
});

/* ---------- Kiinferált típusok ---------- */

export type Verzio = z.infer<typeof VerzioSchema>;
export type Elem = z.infer<typeof ElemSchema>;
export type Kapcsolat = z.infer<typeof KapcsolatSchema>;
export type Szolgaltatas = z.infer<typeof SzolgaltatasSchema>;
export type Alkalmazas = z.infer<typeof AlkalmazasSchema>;
export type Szabalyzat = z.infer<typeof SzabalyzatSchema>;
export type Kiadas = z.infer<typeof KiadasSchema>;
export type Felhasznalo = z.infer<typeof FelhasznaloSchema>;
export type Tagsag = z.infer<typeof TagsagSchema>;
export type Tipus = z.infer<typeof TipusSchema>;
export type Reteg = z.infer<typeof RetegSchema>;
export type Statusznaplo = z.infer<typeof StatusznaploSchema>;
export type Melleklet = z.infer<typeof MellekletSchema>;
export type Megjegyzes = z.infer<typeof MegjegyzesSchema>;
