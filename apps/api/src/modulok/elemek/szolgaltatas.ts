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

  const most = new Date();
  // Versenyhelyzet-biztos: párhuzamos létrehozásnál ütköző kulcsra (E11000) a
  // sorszámot újraszámolva próbálkozunk (a unique index a végső védvonal).
  for (let proba = 0; ; proba++) {
    const sorszam = await kovetkezoSorszam(be.alkalmazasKod, be.tipusKod, retegKod);
    const kulcs = formazKulcs({ alkKod: be.alkalmazasKod, retegKod, tipusKod: be.tipusKod, sorszam });
    try {
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
    } catch (e) {
      if ((e as { code?: number }).code === 11000 && proba < 4) continue;
      throw e;
    }
  }
}

export type ListaNezet = 'osszegzo' | 'teljes';

/** Egy kérésben legfeljebb ennyi elem jöhet — összegző, ill. teljes (tartalommal) nézetben. */
export const OSSZEGZO_MAX = 5000;
export const TELJES_MAX = 500;

/**
 * Az összegző nézet mezői: a listázáshoz, szűréshez, számlálókhoz elég. A tartalom
 * (leírás, típusmezők), a napló, a mellékletek és a megjegyzések kimaradnak — ezek
 * teszik ki a méret zömét; az elem-részlet (GET /api/elemek/:id) adja őket.
 */
const OSSZEGZO_MEZOK = {
  kulcs: 1,
  tipusKod: 1,
  alkalmazasKod: 1,
  retegKod: 1,
  cimkek: 1,
  'verziok.verzioSzam': 1,
  'verziok.statusz': 1,
  'verziok.cim': 1,
  'verziok.hatalyKezdet': 1,
  'verziok.hatalyVeg': 1,
  'verziok.letrehozva': 1,
} as const;

export interface ElemSzuro {
  alkalmazasKod?: string;
  tipusKod?: TipusKod;
  retegKod?: RetegKod;
  statusz?: Statusz;
  cimke?: string;
  kereses?: string;
  /** A felhasználó által látható alkalmazáskódok (olvasási hatókör). */
  lathatoAlkalmazasok?: string[] | 'mind';
  /** Összegző (alap) vagy teljes tartalmú nézet; a teljes csak alkalmazásra szűrve. */
  nezet?: ListaNezet;
  limit?: number;
  offset?: number;
}

export interface ElemListaEredmeny {
  elemek: Record<string, unknown>[];
  /** A szűrésnek megfelelő összes elem (a lapozástól függetlenül). */
  osszes: number;
}

/** Elemlista szűrőkkel + kereséssel, lapozva; az olvasási hatókör érvényesítve. */
export async function elemLista(szuro: ElemSzuro): Promise<ElemListaEredmeny> {
  const nezet: ListaNezet = szuro.nezet ?? 'osszegzo';
  if (nezet === 'teljes' && !szuro.alkalmazasKod)
    throw hiba400('A teljes tartalmú lista csak egy alkalmazásra szűrve kérhető (alkalmazasKod).');
  const max = nezet === 'teljes' ? TELJES_MAX : OSSZEGZO_MAX;
  const limit = Math.min(szuro.limit ?? max, max);
  const offset = szuro.offset ?? 0;

  const q: Record<string, unknown> = {};
  if (szuro.alkalmazasKod) q.alkalmazasKod = szuro.alkalmazasKod;
  if (szuro.tipusKod) q.tipusKod = szuro.tipusKod;
  if (szuro.retegKod) q.retegKod = szuro.retegKod;
  if (szuro.cimke) q.cimkek = szuro.cimke;
  // Státusz: van-e ilyen státuszú verzió — a DB-ben szűrve (index), így a lapozás és a
  // számlálás is helyes (a korábbi memóriabeli utószűrés a teljes halmazt töltötte be).
  if (szuro.statusz) q['verziok.statusz'] = szuro.statusz;

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

  const lekerdezes = Elem.find(q).sort({ kulcs: 1, _id: 1 }).skip(offset).limit(limit);
  if (nezet === 'osszegzo') lekerdezes.select(OSSZEGZO_MEZOK);
  const [docs, osszes] = await Promise.all([lekerdezes.lean(), Elem.countDocuments(q)]);
  return { elemek: docs.map((d) => elemValasz(d as Record<string, unknown>)), osszes };
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
