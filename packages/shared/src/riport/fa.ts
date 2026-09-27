import { uzletiTipus, type TipusKod } from '../tipusok.js';

export interface FaCsomopont {
  id: string;
  kulcs: string;
  tipusKod: TipusKod;
}

export interface LebontasFa {
  /** A fa gyökerei (nincs bejövő lebontja-él a halmazon belül), rendezve. */
  gyokerek: string[];
  /** Fa-élek: szülő → gyerekek, rendezve (több szülős elem CSAK az első szülője alatt). */
  gyerekek: Map<string, string[]>;
  /** Minden elem ÖSSZES lebontó szülője (a több-szülős jelöléshez). */
  szulok: Map<string, string[]>;
  /** Mélységi bejárási sorrend a mélységgel (dosszié/export sorrendje). */
  sorrend: { id: string; melyseg: number; szuloId: string | null }[];
}

/**
 * A `lebontja`-élek mentén fát épít egy elemhalmazra (tiszta függvény).
 * Rendezés: az üzleti típusok elöl, azon belül kulcs szerint. DAG esetén minden
 * elem egyszer szerepel, az ELSŐ szülője alatt; ciklus/elszigeteltség miatt kimaradó
 * elemek gyökérként a végére kerülnek (a `lebontja` a backend szerint ciklusmentes).
 */
export function lebontasFa(
  csomopontok: FaCsomopont[],
  elek: { forras: string; cel: string }[],
): LebontasFa {
  const map = new Map(csomopontok.map((c) => [c.id, c]));
  const osszesGyerek = new Map<string, string[]>();
  const szulok = new Map<string, string[]>();
  for (const e of elek) {
    if (!map.has(e.forras) || !map.has(e.cel) || e.forras === e.cel) continue;
    osszesGyerek.set(e.forras, [...(osszesGyerek.get(e.forras) ?? []), e.cel]);
    szulok.set(e.cel, [...(szulok.get(e.cel) ?? []), e.forras]);
  }

  const rendez = (idk: string[]) =>
    [...new Set(idk)].sort((a, b) => {
      const ca = map.get(a)!;
      const cb = map.get(b)!;
      const ua = uzletiTipus(ca.tipusKod) ? 0 : 1;
      const ub = uzletiTipus(cb.tipusKod) ? 0 : 1;
      return ua !== ub ? ua - ub : ca.kulcs.localeCompare(cb.kulcs, 'hu');
    });

  const gyokerek = rendez(csomopontok.filter((c) => !szulok.has(c.id)).map((c) => c.id));
  const gyerekek = new Map<string, string[]>();
  const sorrend: LebontasFa['sorrend'] = [];
  const latott = new Set<string>();

  const bejar = (id: string, melyseg: number, szuloId: string | null) => {
    latott.add(id);
    sorrend.push({ id, melyseg, szuloId });
    const sajat: string[] = [];
    for (const gy of rendez(osszesGyerek.get(id) ?? [])) {
      if (latott.has(gy)) continue; // már egy korábbi szülő alatt szerepel
      sajat.push(gy);
      bejar(gy, melyseg + 1, id);
    }
    if (sajat.length) gyerekek.set(id, sajat);
  };
  for (const g of gyokerek) if (!latott.has(g)) bejar(g, 0, null);
  // Biztonsági háló: ciklusban ragadt elemek gyökérként.
  const kimaradt = rendez(csomopontok.map((c) => c.id).filter((id) => !latott.has(id)));
  for (const id of kimaradt) {
    if (latott.has(id)) continue;
    gyokerek.push(id);
    bejar(id, 0, null);
  }
  return { gyokerek, gyerekek, szulok, sorrend };
}
