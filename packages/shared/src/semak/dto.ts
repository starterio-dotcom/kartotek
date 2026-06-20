import { z } from 'zod';
import { IdSchema } from './entitasok.js';
import { KapcsolatFajtaSchema, TipusKodSchema, RetegKodSchema } from './enums.js';

/** Új elem létrehozása (az első Vázlat-verzióval). */
export const ElemLetrehozasDto = z.object({
  alkalmazasKod: z.string().min(1),
  tipusKod: TipusKodSchema,
  retegKod: RetegKodSchema.nullable().optional(),
  cim: z.string().min(1),
  leirasMd: z.string().default(''),
  cimkek: z.array(z.string()).default([]),
  tipusMezok: z.record(z.unknown()).default({}),
});
export type ElemLetrehozas = z.infer<typeof ElemLetrehozasDto>;

/** Vázlat-verzió szerkesztése. */
export const VerzioSzerkesztesDto = z.object({
  cim: z.string().min(1).optional(),
  leirasMd: z.string().optional(),
  leiras: z.unknown().optional(), // TipTap/ProseMirror JSON
  cimkek: z.array(z.string()).optional(),
  tipusMezok: z.record(z.unknown()).optional(),
});
export type VerzioSzerkesztes = z.infer<typeof VerzioSzerkesztesDto>;

/** Jóváhagyás (hatálydátumokkal + opcionális indoklás). */
export const JovahagyasDto = z.object({
  hatalyKezdet: z.coerce.date(),
  hatalyVeg: z.coerce.date().nullable().optional(),
  indoklas: z.string().optional(),
});
export type Jovahagyas = z.infer<typeof JovahagyasDto>;

/** Visszadobás / kivezetés — kötelező indoklás. */
export const IndoklasDto = z.object({
  indoklas: z.string().min(1, 'Az indoklás megadása kötelező.'),
});
export type Indoklas = z.infer<typeof IndoklasDto>;

/** Új véleményezési megjegyzés (opcionális horgony / szálazás). */
export const MegjegyzesLetrehozasDto = z.object({
  szoveg: z.string().min(1),
  horgony: z.string().optional(),
  valaszMjid: z.string().optional(),
});
export type MegjegyzesLetrehozas = z.infer<typeof MegjegyzesLetrehozasDto>;

/** Tipizált kapcsolat felvétele. */
export const KapcsolatLetrehozasDto = z
  .object({
    forrasElemId: IdSchema,
    celElemId: IdSchema.nullable().optional(),
    celSzabalyzatKod: z.string().nullable().optional(),
    celKulsoLink: z.string().url().nullable().optional(),
    fajta: KapcsolatFajtaSchema,
  })
  .refine(
    (k) =>
      [k.celElemId, k.celSzabalyzatKod, k.celKulsoLink].filter((x) => x != null).length === 1,
    { message: 'Pontosan egy cél-mezőt kell megadni (elem, szabályzat vagy külső link).' },
  );
export type KapcsolatLetrehozas = z.infer<typeof KapcsolatLetrehozasDto>;
