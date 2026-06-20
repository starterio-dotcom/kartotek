import {
  TIPUS_KODOK,
  RETEG_KODOK,
  uzletiTipus,
  type TipusKod,
  type RetegKod,
} from '../tipusok.js';

/** Egy elem-kulcs alkotórészei (lásd docs/adatmodell.md „Azonosító-séma”). */
export interface KulcsReszek {
  alkKod: string;
  /** Csak technikai elemnél; üzletinél `null`. */
  retegKod: RetegKod | null;
  tipusKod: TipusKod;
  sorszam: number;
}

/** A sorszám alapértelmezett, nullával feltöltött szélessége (`002`). */
export const SORSZAM_SZELESSEG = 3;

function tipusKodE(s: string): s is TipusKod {
  return (TIPUS_KODOK as readonly string[]).includes(s);
}

function retegKodE(s: string): s is RetegKod {
  return (RETEG_KODOK as readonly string[]).includes(s);
}

/**
 * Részekből beszédes kulcsot formáz.
 * - Üzleti típus: `AlkKód-Típus-Sorszám` (réteg nélkül; ha meg van adva, hibát dob).
 * - Technikai típus: `AlkKód-Réteg-Típus-Sorszám` (réteg kötelező).
 */
export function formazKulcs(r: KulcsReszek): string {
  const hibak = validalKulcsReszek(r);
  if (hibak.length) throw new Error(`Érvénytelen kulcs-részek: ${hibak.join(' ')}`);
  const sorszam = String(r.sorszam).padStart(SORSZAM_SZELESSEG, '0');
  return uzletiTipus(r.tipusKod)
    ? `${r.alkKod}-${r.tipusKod}-${sorszam}`
    : `${r.alkKod}-${r.retegKod}-${r.tipusKod}-${sorszam}`;
}

/**
 * Kulcsból részeket elemez. Jobbról dolgozik (sorszám, típus, [réteg]),
 * így az alkalmazáskód elvileg tartalmazhatna kötőjelet is.
 * Érvénytelen alakra `null`.
 */
export function elemezKulcs(kulcs: string): KulcsReszek | null {
  const reszek = kulcs.split('-');
  if (reszek.length < 3) return null;

  const sorszamSzoveg = reszek[reszek.length - 1]!;
  if (!/^\d+$/.test(sorszamSzoveg)) return null;
  const sorszam = Number(sorszamSzoveg);

  const tipusKod = reszek[reszek.length - 2]!;
  if (!tipusKodE(tipusKod)) return null;

  if (uzletiTipus(tipusKod)) {
    const alkKod = reszek.slice(0, reszek.length - 2).join('-');
    if (!alkKod) return null;
    return { alkKod, retegKod: null, tipusKod, sorszam };
  }

  // Technikai: kell réteg a típus előtt.
  if (reszek.length < 4) return null;
  const retegKod = reszek[reszek.length - 3]!;
  if (!retegKodE(retegKod)) return null;
  const alkKod = reszek.slice(0, reszek.length - 3).join('-');
  if (!alkKod) return null;
  return { alkKod, retegKod, tipusKod, sorszam };
}

/** Részek üzleti szabályainak ellenőrzése (a kulcs-egyediséget a DB indexe adja). */
export function validalKulcsReszek(r: KulcsReszek): string[] {
  const hibak: string[] = [];
  if (!r.alkKod) hibak.push('Hiányzik az alkalmazáskód.');
  if (!tipusKodE(r.tipusKod)) hibak.push(`Ismeretlen típuskód: „${r.tipusKod}”.`);
  if (!Number.isInteger(r.sorszam) || r.sorszam <= 0)
    hibak.push('A sorszám pozitív egész kell legyen.');

  if (tipusKodE(r.tipusKod)) {
    if (uzletiTipus(r.tipusKod)) {
      if (r.retegKod != null) hibak.push('Üzleti elemhez nem adható meg réteg.');
    } else {
      if (r.retegKod == null) hibak.push('Technikai elemhez kötelező a réteg.');
      else if (!retegKodE(r.retegKod)) hibak.push(`Ismeretlen rétegkód: „${r.retegKod}”.`);
    }
  }
  return hibak;
}

/** Igaz, ha a kulcs szintaktikailag és üzletileg is érvényes. */
export function ervenyesKulcs(kulcs: string): boolean {
  const r = elemezKulcs(kulcs);
  return r != null && validalKulcsReszek(r).length === 0;
}
