import {
  formazKulcs,
  legnagyobbKiadottSorszam,
  sorszamHatokor,
  uzletiTipus,
  type ElemLetrehozas,
  type TipusKod,
  type RetegKod,
  type Statusz,
} from '@kartotek/shared';
import { Alkalmazas, Elem, ElemSirko, Sorszamlalo } from '../../db/modellek.js';
import { hiba400, hiba404 } from '../../hibak.js';
import { elemValasz, elemBetolt } from '../kozos.js';
import { ellenoriz } from '../../auth/rbac.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';

/** Az eddig VALAHA kiadott legnagyobb sorszám a hatókörben (meglévő elemek + sírkövek). */
async function legnagyobbKiadott(
  alkalmazasKod: string,
  tipusKod: TipusKod,
  retegKod: RetegKod | null,
): Promise<number> {
  const [elemek, sirkovek] = await Promise.all([
    Elem.find({ alkalmazasKod, tipusKod, retegKod }).select('kulcs').lean(),
    ElemSirko.find({ alkalmazasKod, tipusKod, retegKod }).select('sorszam').lean(),
  ]);
  return legnagyobbKiadottSorszam(
    elemek.map((e) => e.kulcs),
    sirkovek.map((s) => s.sorszam),
  );
}

/** A számláló legalább `min`-re állítása ($max: idempotens, soha nem csökkent). */
async function szamlaloLegalabb(hatokor: string, min: number): Promise<void> {
  try {
    await Sorszamlalo.updateOne({ _id: hatokor }, { $max: { ertek: min } }, { upsert: true });
  } catch (e) {
    // Egyidejű első upsert: a vesztes E11000-et kap — a dokumentum már létezik.
    if ((e as { code?: number }).code !== 11000) throw e;
    await Sorszamlalo.updateOne({ _id: hatokor }, { $max: { ertek: min } });
  }
}

/**
 * A következő sorszám atomi foglalása. A számláló csak növekszik, így egy kiadott
 * sorszám — a törölt vázlaté is — soha nem adódik ki újra; párhuzamos létrehozásnál
 * sem kaphat két elem ugyanazt. (A sorszámok között lehet hézag: az azonosító, nem darabszám.)
 */
export async function sorszamFoglal(
  alkalmazasKod: string,
  tipusKod: TipusKod,
  retegKod: RetegKod | null,
): Promise<number> {
  const hatokor = sorszamHatokor(alkalmazasKod, tipusKod, retegKod);
  const foglal = () =>
    Sorszamlalo.findOneAndUpdate({ _id: hatokor }, { $inc: { ertek: 1 } }, { new: true }).lean();
  let doc = await foglal();
  if (!doc) {
    // Első használat a hatókörben: a valaha kiadott legnagyobb sorszámról indulunk.
    await szamlaloLegalabb(hatokor, await legnagyobbKiadott(alkalmazasKod, tipusKod, retegKod));
    doc = await foglal();
  }
  return doc!.ertek;
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
  // A sorszámot atomi számláló adja (nincs versenyhelyzet, nincs újrahasznosítás). Ha
  // mégis ütközne egy létező kulccsal (pl. kézi import után lemaradt számláló), a
  // számlálót a valaha kiadott maximumra emeljük és újrapróbálunk; a unique index a
  // végső védvonal.
  for (let proba = 0; ; proba++) {
    const sorszam = await sorszamFoglal(be.alkalmazasKod, be.tipusKod, retegKod);
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
      if ((e as { code?: number }).code === 11000 && proba < 4) {
        await szamlaloLegalabb(
          sorszamHatokor(be.alkalmazasKod, be.tipusKod, retegKod),
          await legnagyobbKiadott(be.alkalmazasKod, be.tipusKod, retegKod),
        );
        continue;
      }
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

/** Egy keresés legfeljebb ennyi elemet jelöl ki (részhalmazonként). */
const KERESES_MAX = 5000;

/**
 * Keresés = két részhalmaz uniója, mindkettő a hatókör-szűrővel (`alap`) együtt:
 *  1) teljes szövegű (`$text`, magyar szótövezés, indexelt) — a tartalomban is
 *     (a gazdag leírás szövege, rövid leírás, előfeltételek, kritériumok);
 *  2) részszó-illesztés a RÖVID mezőkön (kulcs, cím, címke) — hogy a gépelés közbeni
 *     „3R-BU" is találjon; a `$text` csak teljes szavakra illeszt.
 * A hosszú tartalmat nem pásztázzuk regexszel (ez volt az audit skálázási kifogása).
 */
async function keresesTalalatok(kereses: string, alap: Record<string, unknown>): Promise<unknown[]> {
  const r = new RegExp(kereses.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const resz = Elem.find({ ...alap, $or: [{ kulcs: r }, { 'verziok.cim': r }, { cimkek: r }] })
    .select('_id')
    .limit(KERESES_MAX)
    .lean();
  const szoveges = Elem.find({ ...alap, $text: { $search: kereses, $language: 'hungarian' } })
    .select('_id')
    .limit(KERESES_MAX)
    .lean()
    .catch(async (err: { code?: number }) => {
      // A text index még épül (első indulás) → lassú, de helyes tartalék a kereső-szövegen.
      if (err.code !== 27) throw err;
      return Elem.find({ ...alap, 'verziok.keresoSzoveg': r }).select('_id').limit(KERESES_MAX).lean();
    });
  const [a, b] = await Promise.all([resz, szoveges]);
  const idk = new Map<string, unknown>();
  for (const d of [...a, ...b]) idk.set(String(d._id), d._id);
  return [...idk.values()];
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

  // Olvasási hatókör: csak a látható alkalmazások elemei. Nem látható alkalmazásra
  // szűrve üres a találat (nem a többi látható alkalmazás elemei).
  if (szuro.lathatoAlkalmazasok && szuro.lathatoAlkalmazasok !== 'mind') {
    const engedett = szuro.lathatoAlkalmazasok;
    if (typeof q.alkalmazasKod === 'string')
      q.alkalmazasKod = engedett.includes(q.alkalmazasKod) ? q.alkalmazasKod : { $in: [] };
    else q.alkalmazasKod = { $in: engedett };
  }

  const kereses = szuro.kereses?.trim();
  if (kereses) q._id = { $in: await keresesTalalatok(kereses, q) };

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
