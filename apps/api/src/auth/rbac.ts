import {
  szabad,
  type Muvelet,
  type Kontextus,
  type VerzioCtx,
  type Statusz,
  VEGALLAPOTOK,
} from '@kartotek/shared';
import { hiba403 } from '../hibak.js';
import type { AktualisFelhasznalo } from './plugin.js';

interface VerzioSzeru {
  verzioSzam: number;
  statusz: string;
  modositottaId?: unknown;
  statusznaplo?: { ki: string }[];
}

/** A verzió szerzői/szerkesztői a négy-szem-elvhez: a módosító + a napló nem-RENDSZER szereplői. */
export function szerkesztoIds(verzio: VerzioSzeru): string[] {
  const halmaz = new Set<string>();
  if (verzio.modositottaId != null) halmaz.add(String(verzio.modositottaId));
  for (const n of verzio.statusznaplo ?? []) {
    if (n.ki && n.ki !== 'RENDSZER') halmaz.add(n.ki);
  }
  return [...halmaz];
}

export function verzioCtx(verzio: VerzioSzeru): VerzioCtx {
  return { statusz: verzio.statusz as Statusz, szerkesztoIds: szerkesztoIds(verzio) };
}

/** Van-e az elemen a megadottnál újabb, NEM végállapotú verzió (az „új verzió” szabályhoz). */
export function vanUjabbAktivVerzio(verziok: VerzioSzeru[], verzioSzam: number): boolean {
  return verziok.some(
    (v) => v.verzioSzam > verzioSzam && !VEGALLAPOTOK.includes(v.statusz as Statusz),
  );
}

/** A `shared` jogosultság-függvény kényszerítése: 403, ha nem megengedett. */
export function ellenoriz(
  muvelet: Muvelet,
  felhasznalo: AktualisFelhasznalo,
  extra: Omit<Kontextus, 'felhasznalo'> = {},
): void {
  if (!szabad(muvelet, { felhasznalo, ...extra })) {
    throw hiba403(`A(z) „${muvelet}” művelet nem engedélyezett ebben a kontextusban`);
  }
}
