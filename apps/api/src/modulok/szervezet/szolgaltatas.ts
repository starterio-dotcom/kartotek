import { Alkalmazas, Szolgaltatas, Felhasznalo } from '../../db/modellek.js';
import { hiba404 } from '../../hibak.js';
import { ellenoriz } from '../../auth/rbac.js';
import { globalisAdminKell, type AktualisFelhasznalo } from '../../auth/plugin.js';
import { ervenyesId } from '../kozos.js';

const valasz = ({ _id, __v, ...rest }: Record<string, unknown>) => ({ id: String(_id), ...rest });

export async function szolgaltatasLista(): Promise<Record<string, unknown>[]> {
  return (await Szolgaltatas.find().sort({ kod: 1 }).lean()).map(valasz);
}

/** Felhasználók megjelenítési + szerepkör-adatai (név-feloldáshoz és az admin-kezeléshez). */
export async function felhasznaloLista(): Promise<Record<string, unknown>[]> {
  const docs = await Felhasznalo.find().select('nev email tagsagok globalisAdmin').sort({ nev: 1 }).lean();
  return docs.map((f) => ({
    id: String(f._id),
    nev: f.nev,
    email: f.email,
    tagsagok: (f.tagsagok ?? []).map((t) => ({ alkalmazasKod: t.alkalmazasKod, szerepkor: t.szerepkor })),
    globalisAdmin: f.globalisAdmin ?? false,
  }));
}

/** Felhasználó szerepköreinek (tagságok / globális Admin) frissítése — csak globális Admin. */
export async function felhasznaloFrissites(
  id: string,
  be: { tagsagok?: { alkalmazasKod: string; szerepkor: string }[]; globalisAdmin?: boolean },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  globalisAdminKell(felh);
  if (!ervenyesId(id)) throw hiba404('Felhasználó nem található.');
  const doc = await Felhasznalo.findById(id);
  if (!doc) throw hiba404('Felhasználó nem található.');
  if (be.tagsagok !== undefined) doc.tagsagok = be.tagsagok as never;
  if (be.globalisAdmin !== undefined) doc.globalisAdmin = be.globalisAdmin;
  await doc.save();
  return valasz(doc.toObject());
}

export async function szolgaltatasLetrehozas(
  be: { kod: string; nev: string; leiras?: string; gazdaId?: string },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  ellenoriz('szolgáltatás.kezelés', felh);
  const doc = await Szolgaltatas.create(be);
  return valasz(doc.toObject());
}

export async function szolgaltatasFrissites(
  kod: string,
  be: { nev?: string; leiras?: string },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  globalisAdminKell(felh);
  const doc = await Szolgaltatas.findOne({ kod });
  if (!doc) throw hiba404('Szolgáltatás nem található.');
  if (be.nev !== undefined) doc.nev = be.nev;
  if (be.leiras !== undefined) doc.leiras = be.leiras;
  await doc.save();
  return valasz(doc.toObject());
}

export async function alkalmazasLista(): Promise<Record<string, unknown>[]> {
  return (await Alkalmazas.find().sort({ kod: 1 }).lean()).map(valasz);
}

export async function alkalmazasLetrehozas(
  be: { kod: string; nev: string; leiras?: string; szolgaltatasKod: string },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  // Új alkalmazás létrehozása = szolgáltatás-szintű CRUD → csak globális Admin.
  globalisAdminKell(felh);
  const szolg = await Szolgaltatas.findOne({ kod: be.szolgaltatasKod }).lean();
  if (!szolg) throw hiba404(`Ismeretlen szolgáltatás: ${be.szolgaltatasKod}`);
  const doc = await Alkalmazas.create(be);
  return valasz(doc.toObject());
}

/** Saját alkalmazás metaadatának frissítése (alkalmazás-Admin vagy globális Admin). */
export async function alkalmazasFrissites(
  kod: string,
  be: { nev?: string; leiras?: string },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  ellenoriz('alkalmazás.metaadat', felh, { alkalmazasKod: kod });
  const doc = await Alkalmazas.findOne({ kod });
  if (!doc) throw hiba404('Alkalmazás nem található.');
  if (be.nev !== undefined) doc.nev = be.nev;
  if (be.leiras !== undefined) doc.leiras = be.leiras;
  await doc.save();
  return valasz(doc.toObject());
}
