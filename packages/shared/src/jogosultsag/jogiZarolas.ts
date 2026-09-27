/**
 * Jogi zárolás (legal hold): vizsgálat / jogvita / hatósági megkeresés idejére az elem
 * befagyasztása minden LEZÁRÓ vagy ELTÁVOLÍTÓ művelettel szemben. A tartalmi munka
 * (szerkesztés, beküldés, jóváhagyás, új verzió) mehet tovább — az új verzió a régit
 * változatlanul megőrzi, így a bizonyítékérték nem sérül. Elrendelni és feloldani csak
 * globális Admin tudja, indoklással; minden lépés naplózott.
 */
export const JOGI_ZAROLAS_TILTJA = [
  'vázlat.törlés',
  'verzió.elvetés',
  'verzió.archiválás',
  'melléklet.törlés',
  'kapcsolat.törlés',
] as const;

export type ZarolasAlattTiltott = (typeof JOGI_ZAROLAS_TILTJA)[number];

export interface JogiZarolas {
  aktiv: boolean;
  ok: string;
  kiNev?: string | null;
  mikor?: string | Date | null;
}

/** Igaz, ha az adott műveletet az elem aktív jogi zárolása tiltja. */
export function jogiZarolasTiltja(muvelet: string, zarolas: JogiZarolas | null | undefined): boolean {
  return !!zarolas?.aktiv && (JOGI_ZAROLAS_TILTJA as readonly string[]).includes(muvelet);
}
