import {
  elerhetoVerzioMuveletek,
  VEGALLAPOTOK,
  type Muvelet,
  type Kontextus,
} from '@kartotek/shared';
import type { Elem, Verzio } from '../api/tipusok';
import type { Felhasznalo } from '../api/tipusok';

/** A verzió szerzői/szerkesztői a négy-szem-elvhez (ugyanaz a logika, mint a backenden). */
export function szerkesztoIds(verzio: Verzio): string[] {
  const h = new Set<string>();
  if (verzio.modositottaId) h.add(String(verzio.modositottaId));
  for (const n of verzio.statusznaplo) if (n.ki && n.ki !== 'RENDSZER') h.add(n.ki);
  return [...h];
}

export function vanUjabbAktivVerzio(elem: Elem, verzioSzam: number): boolean {
  return elem.verziok.some((v) => v.verzioSzam > verzioSzam && !VEGALLAPOTOK.includes(v.statusz));
}

/** A `shared` jogosultság + állapotgép alapján elérhető életciklus-műveletek a kontextusban. */
export function elerhetoMuveletek(
  elem: Elem,
  verzio: Verzio,
  felhasznalo: Felhasznalo,
): Muvelet[] {
  const ctx: Kontextus = {
    felhasznalo,
    alkalmazasKod: elem.alkalmazasKod,
    verzio: { statusz: verzio.statusz, szerkesztoIds: szerkesztoIds(verzio) },
    vanUjabbAktivVerzio: vanUjabbAktivVerzio(elem, verzio.verzioSzam),
  };
  return elerhetoVerzioMuveletek(ctx);
}

export type DialogTipus = 'nincs' | 'jovahagyas' | 'visszadobas' | 'kivezetes' | 'elvetes';

export interface MuveletUi {
  muvelet: Muvelet;
  cimke: string;
  akcio: string;
  dialog: DialogTipus;
  valtozat: 'elsodleges' | 'masodlagos' | 'veszelyes';
}

/** Életciklus-művelet → felületi gomb (felirat, végpont, dialógus). */
export const MUVELET_UI: Record<Muvelet & string, MuveletUi | undefined> = {
  'verzió.beküldés': {
    muvelet: 'verzió.beküldés',
    cimke: 'Beküldés véleményezésre',
    akcio: 'bekuldes',
    dialog: 'nincs',
    valtozat: 'elsodleges',
  },
  'verzió.visszavonás': {
    muvelet: 'verzió.visszavonás',
    cimke: 'Visszavonás',
    akcio: 'visszavonas',
    dialog: 'nincs',
    valtozat: 'masodlagos',
  },
  'verzió.jóváhagyás': {
    muvelet: 'verzió.jóváhagyás',
    cimke: 'Jóváhagyás…',
    akcio: 'jovahagyas',
    dialog: 'jovahagyas',
    valtozat: 'elsodleges',
  },
  'verzió.visszadobás': {
    muvelet: 'verzió.visszadobás',
    cimke: 'Visszadobás…',
    akcio: 'visszadobas',
    dialog: 'visszadobas',
    valtozat: 'veszelyes',
  },
  'verzió.elvetés': {
    muvelet: 'verzió.elvetés',
    cimke: 'Elvetés',
    akcio: 'elvetes',
    dialog: 'elvetes',
    valtozat: 'veszelyes',
  },
  'verzió.újverzió': {
    muvelet: 'verzió.újverzió',
    cimke: 'Új verzió nyitása (v+1)',
    akcio: 'ujverzio',
    dialog: 'nincs',
    valtozat: 'masodlagos',
  },
  'verzió.kivezetés': {
    muvelet: 'verzió.kivezetés',
    cimke: 'Kivezetés…',
    akcio: 'kivezetes',
    dialog: 'kivezetes',
    valtozat: 'veszelyes',
  },
  'verzió.archiválás': {
    muvelet: 'verzió.archiválás',
    cimke: 'Archiválás',
    akcio: 'archivalas',
    dialog: 'nincs',
    valtozat: 'masodlagos',
  },
} as Record<string, MuveletUi | undefined>;
