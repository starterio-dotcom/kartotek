import { szabad, verzioSzerzoIds, type Statusz } from '@kartotek/shared';
import { Elem, Felhasznalo } from '../../db/modellek.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';

/** A „Munkám" oldal egy sora: egy verzió, amivel a felhasználónak dolga van. */
export interface MunkamTetel {
  elemId: string;
  kulcs: string;
  alkalmazasKod: string;
  verzioSzam: number;
  cim: string;
  statusz: Statusz;
  /** A sorhoz tartozó esemény ideje (beküldés, visszadobás, létrehozás) vagy a hatálydátum. */
  mikor: string | null;
  /** Aki az eseményt kiváltotta (beküldő, bíráló). */
  kiNev?: string | null;
  /** Visszadobás indoklása. */
  indoklas?: string | null;
  /** Nyitott (megoldatlan) megjegyzések száma. */
  nyitottMegjegyzes?: number;
}

export interface Munkam {
  /** Véleményezésre vár, és ÉN dönthetek róla (szerepkör + négy-szem-elv). */
  ramVar: MunkamTetel[];
  /** A saját verzióm, amit visszadobtak — javítanom kell. */
  visszadobva: MunkamTetel[];
  /** A saját vázlataim (még nem küldtem be). */
  vazlataim: MunkamTetel[];
  /** A saját beküldött verzióim — másra várnak. */
  bekuldve: MunkamTetel[];
  /** Hatályos verziók, amelyek 30 napon belül elavulnak (az alkalmazásaimban). */
  hamarosanLejar: MunkamTetel[];
  /** Jóváhagyott verziók, amelyek 30 napon belül hatályba lépnek. */
  hamarosanHatalyos: MunkamTetel[];
}

const HORIZONT_NAP = 30;

type NaploSor = { honnan?: string | null; hova: string; ki: string; mikor: Date; indoklas?: string };
type VerzioDoc = {
  verzioSzam: number;
  statusz: Statusz;
  cim: string;
  letrehozva: Date;
  hatalyKezdet?: Date | null;
  hatalyVeg?: Date | null;
  modositottaId?: unknown;
  szerkesztok?: unknown[];
  statusznaplo?: NaploSor[];
  megjegyzesek?: { allapot: string }[];
};
type ElemDoc = { _id: unknown; kulcs: string; alkalmazasKod: string; verziok: VerzioDoc[] };

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/**
 * A felhasználó teendői a látható alkalmazásokban. A „rám vár" ugyanazzal a `shared`
 * szabállyal dől el, mint a jóváhagyás gombja és a backend-kényszerítés (szerepkör +
 * négy-szem-elv), így a lista soha nem kínál olyat, amit a felhasználó nem tehet meg.
 */
export async function munkamOsszesito(felh: AktualisFelhasznalo): Promise<Munkam> {
  const lathato = felh.globalisAdmin ? null : [...new Set(felh.tagsagok.map((t) => t.alkalmazasKod))];
  const docs = (await Elem.find({
    ...(lathato ? { alkalmazasKod: { $in: lathato } } : {}),
    'verziok.statusz': { $in: ['Vázlat', 'Véleményezés', 'Jóváhagyott', 'Hatályos'] },
  })
    .select(
      'kulcs alkalmazasKod verziok.verzioSzam verziok.statusz verziok.cim verziok.letrehozva verziok.hatalyKezdet ' +
        'verziok.hatalyVeg verziok.modositottaId verziok.szerkesztok verziok.statusznaplo verziok.megjegyzesek.allapot',
    )
    .lean()) as unknown as ElemDoc[];

  const most = Date.now();
  const horizont = most + HORIZONT_NAP * 86_400_000;
  // Az alkalmazás, ahol érdemi szerepe van (nem csak Olvasó) — a hatály-figyelmeztetésekhez.
  const erdekelt = (alk: string) =>
    felh.globalisAdmin || felh.tagsagok.some((t) => t.alkalmazasKod === alk && t.szerepkor !== 'Olvasó');

  const m: Munkam = { ramVar: [], visszadobva: [], vazlataim: [], bekuldve: [], hamarosanLejar: [], hamarosanHatalyos: [] };
  const nevIdk = new Set<string>();
  const kiIdk = new Map<MunkamTetel, string>();

  for (const e of docs) {
    for (const v of e.verziok) {
      const alap = {
        elemId: String(e._id),
        kulcs: e.kulcs,
        alkalmazasKod: e.alkalmazasKod,
        verzioSzam: v.verzioSzam,
        cim: v.cim,
        statusz: v.statusz,
      };
      const naplo = v.statusznaplo ?? [];
      const utolso = naplo.at(-1);
      const szerzok = verzioSzerzoIds(v);
      const sajat = szerzok.includes(felh.id);
      const nyitott = (v.megjegyzesek ?? []).filter((mj) => mj.allapot === 'nyitott').length;

      if (v.statusz === 'Véleményezés') {
        const bekuldes = [...naplo].reverse().find((n) => n.hova === 'Véleményezés');
        const t: MunkamTetel = { ...alap, mikor: iso(bekuldes?.mikor), nyitottMegjegyzes: nyitott };
        if (bekuldes?.ki) kiIdk.set(t, bekuldes.ki);
        const donthet = szabad('verzió.jóváhagyás', {
          felhasznalo: felh,
          alkalmazasKod: e.alkalmazasKod,
          verzio: { statusz: v.statusz, szerkesztoIds: szerzok },
        });
        if (donthet) m.ramVar.push(t);
        if (sajat) m.bekuldve.push({ ...t });
      } else if (v.statusz === 'Vázlat' && sajat) {
        // Visszadobás: Véleményezés → Vázlat, amit NEM a szerző (hanem a bíráló) lépett.
        const visszadobta = utolso?.honnan === 'Véleményezés' && utolso.hova === 'Vázlat' && !szerzok.includes(utolso.ki);
        if (visszadobta) {
          const t: MunkamTetel = { ...alap, mikor: iso(utolso.mikor), indoklas: utolso.indoklas ?? null, nyitottMegjegyzes: nyitott };
          kiIdk.set(t, utolso.ki);
          m.visszadobva.push(t);
        } else {
          m.vazlataim.push({ ...alap, mikor: iso(v.letrehozva), nyitottMegjegyzes: nyitott });
        }
      } else if (v.statusz === 'Hatályos' && v.hatalyVeg && erdekelt(e.alkalmazasKod)) {
        const veg = new Date(v.hatalyVeg).getTime();
        if (veg <= horizont) m.hamarosanLejar.push({ ...alap, mikor: iso(v.hatalyVeg) });
      } else if (v.statusz === 'Jóváhagyott' && v.hatalyKezdet && erdekelt(e.alkalmazasKod)) {
        const kezd = new Date(v.hatalyKezdet).getTime();
        if (kezd <= horizont) m.hamarosanHatalyos.push({ ...alap, mikor: iso(v.hatalyKezdet) });
      }
    }
  }

  // Nevek feloldása egyetlen lekérdezéssel (a RENDSZER nem felhasználó).
  for (const id of kiIdk.values()) if (/^[0-9a-f]{24}$/i.test(id)) nevIdk.add(id);
  const nevek = new Map(
    (await Felhasznalo.find({ _id: { $in: [...nevIdk] } }).select('nev').lean()).map((u) => [String(u._id), u.nev as string]),
  );
  for (const [t, id] of kiIdk) t.kiNev = nevek.get(id) ?? null;

  const szerint = (irany: 1 | -1) => (a: MunkamTetel, b: MunkamTetel) =>
    irany * ((a.mikor ?? '') < (b.mikor ?? '') ? -1 : (a.mikor ?? '') > (b.mikor ?? '') ? 1 : 0);
  m.ramVar.sort(szerint(1)); // a legrégebben várakozó elöl
  m.visszadobva.sort(szerint(-1));
  m.vazlataim.sort(szerint(-1));
  m.bekuldve.sort(szerint(1));
  m.hamarosanLejar.sort(szerint(1));
  m.hamarosanHatalyos.sort(szerint(1));
  return m;
}
