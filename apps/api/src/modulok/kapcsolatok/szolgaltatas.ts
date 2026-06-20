import { Types } from 'mongoose';
import {
  kapcsolatValidacio,
  VEGALLAPOTOK,
  type KapcsolatLetrehozas,
  type UjKapcsolat,
  type KapcsolatCtx,
  type TipusKod,
  type Statusz,
} from '@kartotek/shared';
import { Elem, Kapcsolat } from '../../db/modellek.js';
import { hiba400, hiba404, hiba409 } from '../../hibak.js';
import { ellenoriz } from '../../auth/rbac.js';
import { ervenyesId } from '../kozos.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';

/** Egy elem akkor „lezárt”, ha minden verziója végállapotban (Archivált/Elvetve). */
function lezart(verziok: { statusz: string }[]): boolean {
  return verziok.length > 0 && verziok.every((v) => VEGALLAPOTOK.includes(v.statusz as Statusz));
}

export interface KapcsolatEredmeny {
  kapcsolat: Record<string, unknown>;
  felajanlElavultat: boolean;
}

export async function kapcsolatLetrehozas(
  be: KapcsolatLetrehozas,
  felh: AktualisFelhasznalo,
): Promise<KapcsolatEredmeny> {
  if (!ervenyesId(be.forrasElemId)) throw hiba400('Érvénytelen forrás-azonosító.');
  const forras = await Elem.findById(be.forrasElemId).lean();
  if (!forras) throw hiba404('A forrás-elem nem található.');

  ellenoriz('kapcsolat.kezelés', felh, { alkalmazasKod: forras.alkalmazasKod });

  // Cél típusa (ha belső elem) + archivált-cél tiltása.
  let celTipus: TipusKod | undefined;
  if (be.celElemId) {
    if (!ervenyesId(be.celElemId)) throw hiba400('Érvénytelen cél-azonosító.');
    const cel = await Elem.findById(be.celElemId).lean();
    if (!cel) throw hiba404('A cél-elem nem található.');
    celTipus = cel.tipusKod as TipusKod;
    if (lezart(cel.verziok)) throw hiba409('Lezárt (archivált/elvetett) elemmel nem köthető új aktív kapcsolat.');
  }

  // Validációs kontextus a DB-ből.
  const meglevoNyers = await Kapcsolat.find({ forrasElemId: forras._id }).lean();
  const meglevoKapcsolatok = meglevoNyers.map((m) => ({
    celElemId: m.celElemId ? String(m.celElemId) : null,
    celSzabalyzatKod: m.celSzabalyzatKod ?? null,
    celKulsoLink: m.celKulsoLink ?? null,
    fajta: m.fajta,
  }));
  const lebontjaNyers = await Kapcsolat.find({ fajta: 'lebontja', celElemId: { $ne: null } })
    .select('forrasElemId celElemId')
    .lean();
  const lebontjaElek = lebontjaNyers.map((e) => ({
    forras: String(e.forrasElemId),
    cel: String(e.celElemId),
  }));

  const uj: UjKapcsolat = {
    forrasElemId: String(forras._id),
    celElemId: be.celElemId ?? null,
    celSzabalyzatKod: be.celSzabalyzatKod ?? null,
    celKulsoLink: be.celKulsoLink ?? null,
    fajta: be.fajta,
  };
  const ctx: KapcsolatCtx = {
    forrasTipus: forras.tipusKod as TipusKod,
    ...(celTipus ? { celTipus } : {}),
    meglevoKapcsolatok,
    lebontjaElek,
  };

  const eredmeny = kapcsolatValidacio(uj, ctx);
  if (!eredmeny.ervenyes) throw hiba400('A kapcsolat érvénytelen.', eredmeny.hibak);

  const doc = await Kapcsolat.create({
    forrasElemId: forras._id,
    celElemId: be.celElemId ? new Types.ObjectId(be.celElemId) : null,
    celSzabalyzatKod: be.celSzabalyzatKod ?? null,
    celKulsoLink: be.celKulsoLink ?? null,
    fajta: be.fajta,
  });

  const { _id, __v, ...rest } = doc.toObject();
  return {
    kapcsolat: { id: String(_id), ...rest },
    felajanlElavultat: eredmeny.felajanlElavultat ?? false,
  };
}

export async function kapcsolatTorles(id: string, felh: AktualisFelhasznalo): Promise<void> {
  if (!ervenyesId(id)) throw hiba400('Érvénytelen kapcsolat-azonosító.');
  const k = await Kapcsolat.findById(id);
  if (!k) throw hiba404('Kapcsolat nem található.');
  const forras = await Elem.findById(k.forrasElemId).lean();
  ellenoriz('kapcsolat.kezelés', felh, { alkalmazasKod: forras?.alkalmazasKod });
  await k.deleteOne();
}

/** Egy elem be- és kimenő kapcsolatai. */
export async function kapcsolatokElemre(id: string): Promise<{
  kimeno: Record<string, unknown>[];
  bejovo: Record<string, unknown>[];
}> {
  if (!ervenyesId(id)) throw hiba400('Érvénytelen elem-azonosító.');
  const oid = new Types.ObjectId(id);
  const [kimeno, bejovo] = await Promise.all([
    Kapcsolat.find({ forrasElemId: oid }).lean(),
    Kapcsolat.find({ celElemId: oid }).lean(),
  ]);
  const map = (a: Record<string, unknown>[]) =>
    a.map(({ _id, __v, ...rest }) => ({ id: String(_id), ...rest }));
  return { kimeno: map(kimeno), bejovo: map(bejovo) };
}
