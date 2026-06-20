import { Types } from 'mongoose';
import { torolhetoE, type TorlesDontes } from '@kartotek/shared';
import { Elem, Kapcsolat } from '../../db/modellek.js';
import { hiba404, hiba409 } from '../../hibak.js';
import { ellenoriz } from '../../auth/rbac.js';
import { ervenyesId } from '../kozos.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';

/** A törlési döntés kiszámítása az elem + kapcsolatainak DB-adataiból. */
async function dontes(id: string): Promise<{
  alkalmazasKod: string;
  kulcs: string;
  oid: Types.ObjectId;
  dontes: TorlesDontes;
}> {
  if (!ervenyesId(id)) throw hiba404('Elem nem található');
  const elem = await Elem.findById(id).select('kulcs alkalmazasKod verziok.statusz').lean();
  if (!elem) throw hiba404('Elem nem található');
  const oid = new Types.ObjectId(id);
  const [bejovo, kimeno] = await Promise.all([
    Kapcsolat.countDocuments({ celElemId: oid }),
    Kapcsolat.countDocuments({ forrasElemId: oid }),
  ]);
  return {
    alkalmazasKod: elem.alkalmazasKod,
    kulcs: elem.kulcs,
    oid,
    dontes: torolhetoE({
      verziok: elem.verziok.map((v) => ({ statusz: v.statusz })),
      bejovoKapcsolatok: bejovo,
      kimenoKapcsolatok: kimeno,
    }),
  };
}

export interface TorlesElokeszites extends TorlesDontes {
  kulcs: string;
}

/** Preflight: visszaadja, hogy az elem fizikailag törölhető-e és miért (nem). */
export async function torlesElokeszit(
  id: string,
  felh: AktualisFelhasznalo,
): Promise<TorlesElokeszites> {
  const d = await dontes(id);
  ellenoriz('vázlat.törlés', felh, { alkalmazasKod: d.alkalmazasKod });
  return { ...d.dontes, kulcs: d.kulcs };
}

/** Fizikai törlés (csak ha a domain-szabály engedi); a kapcsolatait is takarítja. */
export async function elemTorles(id: string, felh: AktualisFelhasznalo): Promise<void> {
  const d = await dontes(id);
  ellenoriz('vázlat.törlés', felh, { alkalmazasKod: d.alkalmazasKod });
  if (!d.dontes.torolheto)
    throw hiba409('Az elem fizikailag nem törölhető.', d.dontes.okok);
  // Csak sosem hivatkozott Vázlatnál érünk ide; kimenő kapcsolat sincs, de a
  // konzisztencia kedvéért takarítunk.
  await Kapcsolat.deleteMany({ $or: [{ forrasElemId: d.oid }, { celElemId: d.oid }] });
  await Elem.deleteOne({ _id: d.oid });
}
