import { Types } from 'mongoose';
import type { Statusz } from '@kartotek/shared';
import { Elem, Kiadas } from '../../db/modellek.js';
import { hiba404 } from '../../hibak.js';
import { ellenoriz } from '../../auth/rbac.js';
import { globalisAdminKell, type AktualisFelhasznalo } from '../../auth/plugin.js';
import { elemBetolt, verzioKeres, elemValasz, ervenyesId } from '../kozos.js';

const valasz = ({ _id, __v, ...rest }: Record<string, unknown>) => ({ id: String(_id), ...rest });

export async function kiadasLista(): Promise<Record<string, unknown>[]> {
  return (await Kiadas.find().sort({ datum: -1 }).lean()).map(valasz);
}

/** Új kiadás (release) felvétele — szolgáltatás-szintű, csak globális Admin. */
export async function kiadasLetrehozas(
  be: { verzio: string; datum: Date },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  globalisAdminKell(felh);
  const doc = await Kiadas.create({ verzio: be.verzio, datum: be.datum });
  return valasz(doc.toObject());
}

/** Egy verzió kiadáshoz rendelése / leválasztása (alkalmazás-Szerző vagy Admin). */
export async function verzioKiadasBeallit(
  id: string,
  verzioSzam: number,
  kiadasId: string,
  hozzarendel: boolean,
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  if (!ervenyesId(kiadasId)) throw hiba404('Kiadás nem található.');
  const kiadas = await Kiadas.findById(kiadasId).lean();
  if (!kiadas) throw hiba404('Kiadás nem található.');

  const elem = await elemBetolt(id);
  ellenoriz('kiadás.kezelés', felh, { alkalmazasKod: elem.alkalmazasKod });
  const v = verzioKeres(elem, verzioSzam);

  const oid = new Types.ObjectId(kiadasId);
  const meglevo = (v.kiadasIds ?? []).map((x) => String(x));
  if (hozzarendel) {
    if (!meglevo.includes(kiadasId)) v.kiadasIds.push(oid as never);
  } else {
    v.kiadasIds = v.kiadasIds.filter((x) => String(x) !== kiadasId) as never;
  }
  elem.markModified('verziok');
  await elem.save();
  return elemValasz(elem.toObject());
}

export interface KiadasVerzio {
  elemId: string;
  kulcs: string;
  cim: string;
  alkalmazasKod: string;
  verzioSzam: number;
  statusz: Statusz;
}

export interface KiadasTartalom {
  kiadas: { id: string; verzio: string; datum: Date };
  verziok: KiadasVerzio[];
}

/** Egy kiadáshoz rendelt verziók (a látható alkalmazásokra szűrve). */
export async function kiadasTartalom(
  kiadasId: string,
  lathato: string[] | 'mind',
): Promise<KiadasTartalom> {
  if (!ervenyesId(kiadasId)) throw hiba404('Kiadás nem található.');
  const kiadas = await Kiadas.findById(kiadasId).lean();
  if (!kiadas) throw hiba404('Kiadás nem található.');
  const oid = new Types.ObjectId(kiadasId);

  const q: Record<string, unknown> = { 'verziok.kiadasIds': oid };
  if (lathato !== 'mind') q.alkalmazasKod = { $in: lathato };

  const docs = await Elem.find(q).select('kulcs alkalmazasKod verziok').lean();
  const verziok: KiadasVerzio[] = [];
  for (const e of docs) {
    for (const v of e.verziok) {
      if ((v.kiadasIds ?? []).some((x) => String(x) === kiadasId))
        verziok.push({
          elemId: String(e._id),
          kulcs: e.kulcs,
          cim: v.cim,
          alkalmazasKod: e.alkalmazasKod,
          verzioSzam: v.verzioSzam,
          statusz: v.statusz as Statusz,
        });
    }
  }
  verziok.sort((a, b) => a.kulcs.localeCompare(b.kulcs) || a.verzioSzam - b.verzioSzam);
  return {
    kiadas: { id: String(kiadas._id), verzio: kiadas.verzio, datum: kiadas.datum },
    verziok,
  };
}
