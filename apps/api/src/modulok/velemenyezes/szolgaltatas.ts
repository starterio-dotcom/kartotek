import { Types } from 'mongoose';
import type { MegjegyzesLetrehozas } from '@kartotek/shared';
import { hiba404 } from '../../hibak.js';
import { ellenoriz } from '../../auth/rbac.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';
import { elemBetolt, verzioKeres, elemValasz } from '../kozos.js';

type Valasz = Record<string, unknown>;

/** Új véleményezési megjegyzés (szálazott, opcionális horgony). */
export async function megjegyzesLetrehozas(
  id: string,
  vsz: number,
  be: MegjegyzesLetrehozas,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, vsz);
  ellenoriz('megjegyzés.írás', felh, { alkalmazasKod: elem.alkalmazasKod });

  if (be.valaszMjid && !v.megjegyzesek.some((m) => m.mjid === be.valaszMjid))
    throw hiba404('A hivatkozott szülő megjegyzés nem található.');

  v.megjegyzesek.push({
    mjid: new Types.ObjectId().toString(),
    szerzoId: felh.id as never,
    szoveg: be.szoveg,
    ...(be.horgony ? { horgony: be.horgony } : {}),
    ...(be.valaszMjid ? { valaszMjid: be.valaszMjid } : {}),
    allapot: 'nyitott',
    letrehozva: new Date(),
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}

/** Megjegyzés megoldottra állítása. */
export async function megjegyzesMegoldas(
  id: string,
  vsz: number,
  mjid: string,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, vsz);
  ellenoriz('megjegyzés.megoldás', felh, { alkalmazasKod: elem.alkalmazasKod });
  const mj = v.megjegyzesek.find((m) => m.mjid === mjid);
  if (!mj) throw hiba404('Megjegyzés nem található.');
  mj.allapot = 'megoldott';
  await elem.save();
  return elemValasz(elem.toObject());
}
