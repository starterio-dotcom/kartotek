import {
  szabad,
  verzioSzerzoIds,
  type Muvelet,
  type Kontextus,
  type VerzioCtx,
  type Statusz,
  type SzerzoForras,
  VEGALLAPOTOK,
} from '@kartotek/shared';
import { hiba403 } from '../hibak.js';
import type { AktualisFelhasznalo } from './plugin.js';

interface VerzioSzeru extends SzerzoForras {
  verzioSzam: number;
  statusz: string;
}

/**
 * A verzió szerzői a négy-szem-elvhez — a `shared` egyetlen igazsága (a FE és az
 * értesítés-címzés is ezt használja): minden tartalom-szerkesztő (`szerkesztok`, így a
 * több-szerzős vázlat sem játszható ki), a legutóbbi módosító, a létrehozó és a beküldő.
 * A bíráló (visszadobás) és a puszta véleményező NEM szerző — a Jóváhagyó dolga épp a
 * véleményezés, őt nem zárjuk ki a jóváhagyásból.
 */
export function szerkesztoIds(verzio: VerzioSzeru): string[] {
  return verzioSzerzoIds(verzio);
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
