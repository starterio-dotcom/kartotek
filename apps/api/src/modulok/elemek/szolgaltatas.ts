import {
  formazKulcs,
  uzletiTipus,
  type ElemLetrehozas,
  type TipusKod,
  type RetegKod,
  type Statusz,
} from '@kartotek/shared';
import { Alkalmazas, Elem } from '../../db/modellek.js';
import { hiba400, hiba404 } from '../../hibak.js';
import { elemValasz, elemBetolt } from '../kozos.js';
import { ellenoriz } from '../../auth/rbac.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';

/** A következő szabad sorszám az adott alkalmazás+típus(+réteg) hármasra. */
async function kovetkezoSorszam(
  alkalmazasKod: string,
  tipusKod: TipusKod,
  retegKod: RetegKod | null,
): Promise<number> {
  const meglevok = await Elem.find({ alkalmazasKod, tipusKod, retegKod }).select('kulcs').lean();
  let max = 0;
  for (const e of meglevok) {
    const m = e.kulcs.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max + 1;
}

/** Új elem létrehozása az első Vázlat-verzióval. */
export async function elemLetrehozas(
  be: ElemLetrehozas,
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  const alk = await Alkalmazas.findOne({ kod: be.alkalmazasKod }).lean();
  if (!alk) throw hiba404(`Ismeretlen alkalmazás: ${be.alkalmazasKod}`);

  const uzleti = uzletiTipus(be.tipusKod);
  const retegKod = uzleti ? null : (be.retegKod ?? null);
  if (uzleti && be.retegKod) throw hiba400('Üzleti típushoz nem adható meg réteg.');
  if (!uzleti && !retegKod) throw hiba400('Technikai típushoz kötelező a réteg.');

  const sorszam = await kovetkezoSorszam(be.alkalmazasKod, be.tipusKod, retegKod);
  const kulcs = formazKulcs({ alkKod: be.alkalmazasKod, retegKod, tipusKod: be.tipusKod, sorszam });

  const most = new Date();
  const elem = await Elem.create({
    kulcs,
    tipusKod: be.tipusKod,
    alkalmazasKod: be.alkalmazasKod,
    retegKod,
    cimkek: be.cimkek,
    verziok: [
      {
        verzioSzam: 1,
        statusz: 'Vázlat' as Statusz,
        cim: be.cim,
        leirasMd: be.leirasMd,
        tipusMezok: be.tipusMezok,
        letrehozva: most,
        modositottaId: felh.id,
        statusznaplo: [{ hova: 'Vázlat', mikor: most, ki: felh.id, indoklas: 'létrehozás' }],
      },
    ],
  });
  return elemValasz(elem.toObject());
}

export interface ElemSzuro {
  alkalmazasKod?: string;
  tipusKod?: TipusKod;
  retegKod?: RetegKod;
  statusz?: Statusz;
  cimke?: string;
  kereses?: string;
  /** A felhasználó által látható alkalmazáskódok (olvasási hatókör). */
  lathatoAlkalmazasok?: string[] | 'mind';
}

/** Elemlista szűrőkkel + kereséssel; az olvasási hatókör érvényesítve. */
export async function elemLista(szuro: ElemSzuro): Promise<Record<string, unknown>[]> {
  const q: Record<string, unknown> = {};
  if (szuro.alkalmazasKod) q.alkalmazasKod = szuro.alkalmazasKod;
  if (szuro.tipusKod) q.tipusKod = szuro.tipusKod;
  if (szuro.retegKod) q.retegKod = szuro.retegKod;
  if (szuro.cimke) q.cimkek = szuro.cimke;

  // Olvasási hatókör: csak a látható alkalmazások elemei.
  if (szuro.lathatoAlkalmazasok && szuro.lathatoAlkalmazasok !== 'mind') {
    const engedett = szuro.lathatoAlkalmazasok;
    q.alkalmazasKod =
      typeof q.alkalmazasKod === 'string' && engedett.includes(q.alkalmazasKod)
        ? q.alkalmazasKod
        : { $in: engedett };
  }

  if (szuro.kereses) {
    const r = new RegExp(szuro.kereses.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ kulcs: r }, { 'verziok.cim': r }, { 'verziok.leirasMd': r }, { cimkek: r }];
  }

  const docs = await Elem.find(q).sort({ kulcs: 1 }).lean();
  let talalat = docs.map(elemValasz);

  // Státuszszűrő: van-e a megadott státuszú verzió (post-szűrés a beágyazás miatt).
  if (szuro.statusz) {
    const st = szuro.statusz;
    talalat = talalat.filter((e) =>
      (e.verziok as { statusz: Statusz }[]).some((v) => v.statusz === st),
    );
  }
  return talalat;
}

/** Egy elem részletei (verziók + napló + melléklet + megjegyzés). */
export async function elemReszlet(id: string): Promise<Record<string, unknown>> {
  const doc = await Elem.findById(id).lean();
  if (!doc) throw hiba404('Elem nem található');
  return elemValasz(doc);
}

/** Az elem címkéinek frissítése (elem-szintű, a verzió státuszától független). */
export async function cimkekFrissites(
  id: string,
  cimkek: string[],
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  const elem = await elemBetolt(id);
  ellenoriz('címke.kezelés', felh, { alkalmazasKod: elem.alkalmazasKod });
  elem.cimkek = [...new Set(cimkek.map((c) => c.trim()).filter(Boolean))];
  await elem.save();
  return elemValasz(elem.toObject());
}
