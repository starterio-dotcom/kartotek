import type { KapcsolatFajta, Statusz, TipusKod } from '@kartotek/shared';

export interface GrafCsomopont {
  id: string;
  kulcs: string;
  tipusKod: TipusKod;
  retegKod: string | null;
  alkalmazasKod: string;
  statusz: Statusz;
}
export interface GrafEl {
  id: string;
  forras: string;
  cel: string;
  fajta: KapcsolatFajta;
}
export interface Graf {
  csomopontok: GrafCsomopont[];
  szabalyzatok: string[];
  elek: GrafEl[];
}

/** Szintkiosztás a `lebontja`-hierarchia mentén (docs/kapcsolatok.md). */
export const SZINT: Record<string, number> = { BUS: 0, F: 1, TUC: 1, TUS: 2, BD: 3, TD: 3 };
export const SZABALYZAT_SZINT = 4;

export function szintje(tipusKod: string): number {
  return SZINT[tipusKod] ?? 2;
}

/** Éltípusonkénti stílus (a korábban auditált, 3:1 feletti kontrasztú színek). */
export const EL_STILUS: Record<KapcsolatFajta, { szin: string; dash: string; vastagsag: number }> = {
  lebontja: { szin: '#4258ED', dash: '', vastagsag: 2 },
  'függ tőle': { szin: '#A65200', dash: '7 4', vastagsag: 2 },
  hivatkozik: { szin: '#5C6677', dash: '2 5', vastagsag: 2 },
  megfelel: { szin: '#065E90', dash: '11 4', vastagsag: 2 },
  leváltja: { szin: '#D6220F', dash: '', vastagsag: 2.6 },
};

export const NODE_W = 178;
export const NODE_H = 52;
const COL_GAP = 34;
const LAYER_GAP = 100;
const MARGIN = 30;

export interface PozCsomopont {
  id: string;
  cimke: string;
  szint: number;
  tipus: 'elem' | 'szabalyzat';
  x: number;
  y: number;
  statusz?: Statusz;
}

export interface Elrendezes {
  csomopontok: PozCsomopont[];
  szelesseg: number;
  magassag: number;
}

/** A gráf rétegezett elrendezése: y a szint szerint, x a szinten belüli sorrendben. */
export function elrendez(graf: Graf): Elrendezes {
  const nyers: Omit<PozCsomopont, 'x' | 'y'>[] = [
    ...graf.csomopontok.map((c) => ({
      id: c.id,
      cimke: c.kulcs,
      szint: szintje(c.tipusKod),
      tipus: 'elem' as const,
      statusz: c.statusz,
    })),
    ...graf.szabalyzatok.map((kod) => ({
      id: `sz:${kod}`,
      cimke: kod,
      szint: SZABALYZAT_SZINT,
      tipus: 'szabalyzat' as const,
    })),
  ];

  const szintenkent = new Map<number, typeof nyers>();
  for (const n of nyers) {
    const lista = szintenkent.get(n.szint) ?? [];
    lista.push(n);
    szintenkent.set(n.szint, lista);
  }

  let maxSzelesseg = 0;
  let maxSzint = 0;
  const csomopontok: PozCsomopont[] = [];
  for (const [szint, lista] of szintenkent) {
    lista.sort((a, b) => a.cimke.localeCompare(b.cimke));
    lista.forEach((n, i) => {
      csomopontok.push({
        ...n,
        x: MARGIN + i * (NODE_W + COL_GAP),
        y: MARGIN + szint * (NODE_H + LAYER_GAP),
      });
    });
    maxSzelesseg = Math.max(maxSzelesseg, MARGIN + lista.length * (NODE_W + COL_GAP));
    maxSzint = Math.max(maxSzint, szint);
  }

  return {
    csomopontok,
    szelesseg: Math.max(maxSzelesseg, 320),
    magassag: MARGIN + (maxSzint + 1) * (NODE_H + LAYER_GAP),
  };
}

/** A kijelölt csomópont közvetlen szomszédsága (önmaga + szomszédok). */
export function kornyezet(elek: GrafEl[], kijeloltId: string): Set<string> {
  const halmaz = new Set<string>([kijeloltId]);
  for (const e of elek) {
    if (e.forras === kijeloltId) halmaz.add(e.cel);
    if (e.cel === kijeloltId) halmaz.add(e.forras);
  }
  return halmaz;
}
