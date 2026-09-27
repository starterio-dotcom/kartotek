/** Felületi értesítések megjelenítési logikája (tiszta függvények). */
import type { Ertesites } from '../api/tipusok';

/** Az esemény kiírt felirata — a jelentést nem csak a szín/ikon hordozza. */
export const ESEMENY_CIMKE: Record<Ertesites['esemeny'], string> = {
  bekuldes: 'Véleményezésre vár',
  jovahagyas: 'Jóváhagyva',
  visszadobas: 'Visszadobva',
  megjegyzes: 'Megjegyzés',
};

/** Relatív időpont magyarul („most", „5 perce", „2 órája", „tegnap", dátum). */
export function relativIdo(iso: string, most: Date = new Date()): string {
  const d = new Date(iso);
  const mp = Math.max(0, Math.round((most.getTime() - d.getTime()) / 1000));
  if (mp < 60) return 'most';
  const perc = Math.round(mp / 60);
  if (perc < 60) return `${perc} perce`;
  const ora = Math.round(perc / 60);
  if (ora < 24) return `${ora} órája`;
  const nap = Math.round(ora / 24);
  if (nap === 1) return 'tegnap';
  if (nap < 7) return `${nap} napja`;
  return d.toLocaleDateString('hu-HU');
}
