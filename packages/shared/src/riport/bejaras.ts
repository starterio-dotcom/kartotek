import type { TipusKod } from '../tipusok.js';

/** Irányított él két csomópont között (forrás → cél). */
export interface El {
  forras: string;
  cel: string;
}

/**
 * A `start`-ból irányítottan elérhető csomópontok, a legrövidebb úthossz (mélység)
 * szerint. A `start` maga NINCS benne. BFS, körbiztos (a `latott`-halmaz miatt).
 */
export function elerhetoCsomopontok(start: string, elek: El[]): Map<string, number> {
  const tav = new Map<string, number>();
  const latott = new Set<string>([start]);
  const sor: { id: string; melyseg: number }[] = [{ id: start, melyseg: 0 }];
  while (sor.length) {
    const { id, melyseg } = sor.shift()!;
    for (const e of elek) {
      if (e.forras === id && !latott.has(e.cel)) {
        latott.add(e.cel);
        tav.set(e.cel, melyseg + 1);
        sor.push({ id: e.cel, melyseg: melyseg + 1 });
      }
    }
  }
  return tav;
}

export interface HatasEredmeny {
  /** Lefelé: amit a `start` (közvetve) lebont / amitől függ — ami az áthat. */
  lefele: { id: string; melyseg: number }[];
  /** Felfelé: ami a `start`-ot lebontja / ami tőle függ — amit érint a változás. */
  felfele: { id: string; melyseg: number }[];
}

/**
 * Hatáselemzés egy elemre a megadott (lebontja/függ tőle) éleken: mit érint, ha
 * változik. Lefelé az élek mentén, felfelé a megfordított éleken jár be.
 */
export function hatasElemzes(start: string, elek: El[]): HatasEredmeny {
  const fordit = elek.map((e) => ({ forras: e.cel, cel: e.forras }));
  const rendez = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([id, melyseg]) => ({ id, melyseg }))
      .sort((a, b) => a.melyseg - b.melyseg);
  return {
    lefele: rendez(elerhetoCsomopontok(start, elek)),
    felfele: rendez(elerhetoCsomopontok(start, fordit)),
  };
}

export interface LefedettsegCsomopont {
  id: string;
  tipusKod: TipusKod;
}

/**
 * Lefedettség: mely BUS elemekhez nem tartozik (közvetve) TUS a `lebontja`-fa
 * mentén. Az így visszaadott id-k a „fedetlen” üzleti story-k.
 */
export function lefedetlenBus(
  csomopontok: LefedettsegCsomopont[],
  lebontjaElek: El[],
): string[] {
  const tipus = new Map(csomopontok.map((c) => [c.id, c.tipusKod]));
  const fedetlen: string[] = [];
  for (const c of csomopontok) {
    if (c.tipusKod !== 'BUS') continue;
    const leszarmazottak = elerhetoCsomopontok(c.id, lebontjaElek);
    const vanTus = [...leszarmazottak.keys()].some((id) => tipus.get(id) === 'TUS');
    if (!vanTus) fedetlen.push(c.id);
  }
  return fedetlen;
}
