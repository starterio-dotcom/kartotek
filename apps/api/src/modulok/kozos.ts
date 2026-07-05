import { Types, type HydratedDocument } from 'mongoose';
import type { Statusz } from '@kartotek/shared';
import { Elem, type ElemDoc } from '../db/modellek.js';
import { hiba400, hiba404 } from '../hibak.js';
import { tarolt } from '../tarhely/tarhely.js';

export type ElemHidratalt = HydratedDocument<ElemDoc>;

export function ervenyesId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/** Hidratált (módosítható) elem betöltése írási műveletekhez. */
export async function elemBetolt(id: string): Promise<ElemHidratalt> {
  if (!ervenyesId(id)) throw hiba400('Érvénytelen elem-azonosító');
  const elem = await Elem.findById(id);
  if (!elem) throw hiba404('Elem nem található');
  return elem as ElemHidratalt;
}

/** Egy verzió kikeresése verziószám alapján. */
export function verzioKeres(elem: ElemHidratalt, verzioSzam: number) {
  const v = elem.verziok.find((x) => x.verzioSzam === verzioSzam);
  if (!v) throw hiba404(`A(z) v${verzioSzam} verzió nem található`);
  return v;
}

/** Append-only naplóbejegyzés + státuszléptetés egy verzión. */
export function naplozEsLeptet(
  verzio: { statusz: Statusz; statusznaplo: unknown[] },
  hova: Statusz,
  ki: string,
  indoklas?: string,
): void {
  (verzio.statusznaplo as Record<string, unknown>[]).push({
    honnan: verzio.statusz,
    hova,
    mikor: new Date(),
    ki,
    ...(indoklas ? { indoklas } : {}),
  });
  verzio.statusz = hova;
}

/**
 * Lean dokumentum → API-válasz: `_id` → `id`, `__v` elhagyva. A mellékletek
 * `vanTartalom` jelzőt kapnak: a tartalom-végpont ki tudja-e szolgálni a fájlt
 * (a seed:// és a csak-link Figma hivatkozás mögött nincs tárolt bájt) — így a
 * kliens meg sem próbálja letölteni a nem létező tartalmat.
 */
export function elemValasz(doc: Record<string, unknown>): Record<string, unknown> {
  const { _id, __v, ...rest } = doc;
  const verziok = Array.isArray(rest.verziok)
    ? (rest.verziok as Record<string, unknown>[]).map((v) => ({
        ...v,
        mellekletek: Array.isArray(v.mellekletek)
          ? (v.mellekletek as Record<string, unknown>[]).map((m) => ({
              ...m,
              vanTartalom: tarolt((m.figmaPng ?? m.tartalomHiv) as string | undefined),
            }))
          : v.mellekletek,
      }))
    : rest.verziok;
  return { id: String(_id), ...rest, verziok };
}
