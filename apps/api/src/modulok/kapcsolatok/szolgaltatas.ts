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
import { hiba400, hiba403, hiba404, hiba409 } from '../../hibak.js';
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
    // Csak olyan elemre köthető kapcsolat, amelyet a felhasználó olvashat. Az olvashatatlan
    // cél ugyanúgy 404, mint a nem létező — ne legyen belőle létezés-orákulum.
    const celOlvashato =
      !!cel && (felh.globalisAdmin || felh.tagsagok.some((t) => t.alkalmazasKod === cel.alkalmazasKod));
    if (!cel || !celOlvashato) throw hiba404('A cél-elem nem található.');
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

/**
 * Egy elem be- és kimenő kapcsolatai, az olvasási hatókör szerint.
 *
 * Az elemnek magának olvashatónak kell lennie (különben 403, mint a részletnél).
 * A spec szerint az alkalmazásközi kapcsolat „akkor látszik teljesen, ha mindkét
 * véget olvashatod; egyébként hivatkozás-csonkként jelenik meg": a nem olvasható
 * túloldali elem azonosítója kimarad, a kapcsolat `csonk: true` jelölést kap.
 */
export async function kapcsolatokElemre(
  id: string,
  lathato: string[] | 'mind',
): Promise<{ kimeno: Record<string, unknown>[]; bejovo: Record<string, unknown>[] }> {
  if (!ervenyesId(id)) throw hiba400('Érvénytelen elem-azonosító.');
  const oid = new Types.ObjectId(id);
  const sajat = await Elem.findById(oid).select('alkalmazasKod').lean();
  if (!sajat) throw hiba404('Elem nem található');
  const olvashato = (kod: string | undefined) => lathato === 'mind' || (!!kod && lathato.includes(kod));
  if (!olvashato(sajat.alkalmazasKod)) throw hiba403('Nincs olvasási jogosultság ehhez az alkalmazáshoz.');

  const [kimeno, bejovo] = await Promise.all([
    Kapcsolat.find({ forrasElemId: oid }).lean(),
    Kapcsolat.find({ celElemId: oid }).lean(),
  ]);

  // A túloldali elemek alkalmazása (egy lekérdezésben) a csonkolás eldöntéséhez.
  const tuloldal = [
    ...kimeno.map((k) => k.celElemId).filter(Boolean),
    ...bejovo.map((k) => k.forrasElemId),
  ] as Types.ObjectId[];
  const alkMap = new Map<string, string>();
  if (lathato !== 'mind' && tuloldal.length) {
    const docs = await Elem.find({ _id: { $in: tuloldal } }).select('alkalmazasKod').lean();
    for (const d of docs) alkMap.set(String(d._id), d.alkalmazasKod);
  }
  const lathatoElem = (eid: unknown) => lathato === 'mind' || olvashato(alkMap.get(String(eid)));

  const alap = ({ _id, __v, ...rest }: Record<string, unknown>) => ({ id: String(_id), ...rest });
  return {
    kimeno: kimeno.map((k) =>
      !k.celElemId || lathatoElem(k.celElemId)
        ? alap(k)
        : { ...alap(k), celElemId: null, csonk: true },
    ),
    bejovo: bejovo.map((k) =>
      lathatoElem(k.forrasElemId) ? alap(k) : { ...alap(k), forrasElemId: null, csonk: true },
    ),
  };
}
