/**
 * A domain literál-uniói — EGYETLEN igazságforrás.
 * Ezeket importálja a Zod, a Mongoose `enum` és a domain-modulok is
 * (lásd docs/mongoose-sema.md, docs/domain-mag-vazlat.md).
 */

export const STATUSZOK = [
  'Vázlat',
  'Véleményezés',
  'Jóváhagyott',
  'Hatályos',
  'Elavult',
  'Archivált',
  'Elvetve',
] as const;

export const SZEREPKOROK = ['Olvasó', 'Szerző', 'Jóváhagyó', 'Admin'] as const;

export const TIPUS_KODOK = ['BUS', 'TUS', 'TUC', 'F', 'BD', 'TD'] as const;

export const RETEG_KODOK = ['FE', 'Core', 'TAPI', 'TDB'] as const;

export const KAPCSOLAT_FAJTAK = [
  'lebontja',
  'függ tőle',
  'hivatkozik',
  'megfelel',
  'leváltja',
] as const;

export const MELLEKLET_TIPUSOK = ['kep', 'figma', 'csv', 'video'] as const;

export const MEGJEGYZES_ALLAPOTOK = ['nyitott', 'megoldott'] as const;

export const DONTES_EREDMENYEK = ['jóváhagyva', 'visszadobva'] as const;

export type Statusz = (typeof STATUSZOK)[number];
export type Szerepkor = (typeof SZEREPKOROK)[number];
export type TipusKod = (typeof TIPUS_KODOK)[number];
export type RetegKod = (typeof RETEG_KODOK)[number];
export type KapcsolatFajta = (typeof KAPCSOLAT_FAJTAK)[number];
export type MellekletTipus = (typeof MELLEKLET_TIPUSOK)[number];
export type MegjegyzesAllapot = (typeof MEGJEGYZES_ALLAPOTOK)[number];
export type DontesEredmeny = (typeof DONTES_EREDMENYEK)[number];

/**
 * Mely típuskódok üzletiek (réteg nélküliek). Élesben a `tipusok` referencia-
 * kollekció `uzleti` jelzője a forrás; ez a `shared` alapértéke a validátorhoz
 * és a seedhez (lásd docs/adatmodell.md „Típusrendszer”).
 */
export const UZLETI_TIPUSOK: readonly TipusKod[] = ['BUS', 'BD'];

export function uzletiTipus(kod: TipusKod): boolean {
  return UZLETI_TIPUSOK.includes(kod);
}
