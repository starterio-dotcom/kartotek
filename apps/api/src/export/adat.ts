import { lebontasFa, tiptapSzoveg, type TipusKod } from '@kartotek/shared';
import { Alkalmazas, Elem, Kapcsolat } from '../db/modellek.js';
import { hiba403, hiba404 } from '../hibak.js';

export type ExportMod = 'hatalyos' | 'legujabb';

export interface ExportSor {
  id: string;
  kulcs: string;
  tipusKod: string;
  retegKod: string | null;
  melyseg: number;
  /** A fa-beli (első) lebontó szülő kulcsa. */
  szuloKulcs: string | null;
  /** Az összes lebontó szülő kulcsa (több szülős elemnél >1). */
  szulok: string[];
  verzioSzam: number;
  statusz: string;
  cim: string;
  rovid: string;
  leiras: string;
  elofeltetelek: string;
  kriteriumok: string;
  cia: string;
  cimkek: string[];
  hatalyKezdet: string | null;
  hatalyVeg: string | null;
  /** A kimenő kapcsolatok olvasható összefoglalója (külső linkek, szabályzatok is). */
  kapcsolatok: string;
  modositva: string;
}

export interface ExportAdat {
  alkalmazas: { kod: string; nev: string; leiras: string };
  mod: ExportMod;
  generalva: Date;
  /** A lebontás-fa mélységi sorrendjében. */
  sorok: ExportSor[];
  /** Csak a MINDKÉT végén exportált elemek közti kapcsolatok (ReqIF-ben csak ez hivatkozható). */
  kapcsolatok: { id: string; forrasId: string; celId: string; fajta: string; modositva: string }[];
  /** Fa-élek (szülő → gyerekek) a hierarchiához. */
  gyerekek: Map<string, string[]>;
  gyokerek: string[];
}

type NyersVerzio = {
  verzioSzam: number;
  statusz: string;
  cim: string;
  leiras?: unknown;
  leirasMd?: string;
  tipusMezok?: Record<string, unknown>;
  hatalyKezdet?: Date | null;
  hatalyVeg?: Date | null;
};

/** A dosszié szabálya: hatályos módban a legmagasabb Hatályos verzió, egyébként a legújabb. */
function verzioValaszt(verziok: NyersVerzio[], mod: ExportMod): NyersVerzio | null {
  const csokkeno = [...verziok].sort((a, b) => b.verzioSzam - a.verzioSzam);
  return mod === 'hatalyos' ? (csokkeno.find((v) => v.statusz === 'Hatályos') ?? null) : (csokkeno[0] ?? null);
}

const nap = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const szoveg = (x: unknown) => (typeof x === 'string' ? x : '');

/**
 * Egy alkalmazás exportálható adatai. Hatókör: az alkalmazást olvasni kell tudni;
 * a kimenő kapcsolatok nem olvasható túloldala „(nem látható elem)" (mint a csonk).
 */
export async function exportAdat(
  alkalmazasKod: string,
  mod: ExportMod,
  lathato: string[] | 'mind',
): Promise<ExportAdat> {
  const olvashato = (kod: string) => lathato === 'mind' || lathato.includes(kod);
  const alk = await Alkalmazas.findOne({ kod: alkalmazasKod }).lean();
  if (!alk) throw hiba404('Alkalmazás nem található.');
  if (!olvashato(alkalmazasKod)) throw hiba403('Nincs olvasási jogosultság ehhez az alkalmazáshoz.');

  const elemek = await Elem.find({ alkalmazasKod }).lean();
  const kivalasztott = elemek
    .map((e) => ({ e, v: verzioValaszt(e.verziok as unknown as NyersVerzio[], mod) }))
    .filter((x): x is { e: (typeof elemek)[number]; v: NyersVerzio } => !!x.v);
  const exportIdk = new Set(kivalasztott.map((x) => String(x.e._id)));

  // Kimenő kapcsolatok + a túloldali elemek kulcsa/alkalmazása (más alkalmazásban is lehet).
  const kapcs = await Kapcsolat.find({ forrasElemId: { $in: elemek.map((e) => e._id) } }).lean();
  const celek = await Elem.find({ _id: { $in: kapcs.map((k) => k.celElemId).filter(Boolean) } })
    .select('kulcs alkalmazasKod')
    .lean();
  const celInfo = new Map(celek.map((c) => [String(c._id), c]));

  const fa = lebontasFa(
    kivalasztott.map(({ e }) => ({ id: String(e._id), kulcs: e.kulcs, tipusKod: e.tipusKod as TipusKod })),
    kapcs
      .filter((k) => k.fajta === 'lebontja' && k.celElemId)
      .map((k) => ({ forras: String(k.forrasElemId), cel: String(k.celElemId) })),
  );
  const kulcsById = new Map(kivalasztott.map(({ e }) => [String(e._id), e.kulcs]));

  const kapcsolatSzoveg = (elemId: string): string => {
    const csoport = new Map<string, string[]>();
    for (const k of kapcs.filter((x) => String(x.forrasElemId) === elemId)) {
      let cel: string;
      if (k.celElemId) {
        const c = celInfo.get(String(k.celElemId));
        cel = c && olvashato(c.alkalmazasKod) ? c.kulcs : '(nem látható elem)';
      } else cel = k.celSzabalyzatKod ?? k.celKulsoLink ?? '—';
      csoport.set(k.fajta, [...(csoport.get(k.fajta) ?? []), cel]);
    }
    return [...csoport].map(([f, c]) => `${f}: ${c.join(', ')}`).join('; ');
  };

  const byId = new Map(kivalasztott.map((x) => [String(x.e._id), x]));
  const sorok: ExportSor[] = fa.sorrend.map(({ id, melyseg, szuloId }) => {
    const { e, v } = byId.get(id)!;
    const tm = (v.tipusMezok ?? {}) as Record<string, unknown>;
    const cia = tm.cia as { c?: number; i?: number; a?: number } | null | undefined;
    return {
      id,
      kulcs: e.kulcs,
      tipusKod: e.tipusKod,
      retegKod: e.retegKod ?? null,
      melyseg,
      szuloKulcs: szuloId ? (kulcsById.get(szuloId) ?? null) : null,
      szulok: (fa.szulok.get(id) ?? []).map((s) => kulcsById.get(s) ?? s),
      verzioSzam: v.verzioSzam,
      statusz: v.statusz,
      cim: v.cim,
      rovid: szoveg(tm.rovid),
      leiras: v.leiras && typeof v.leiras === 'object' ? tiptapSzoveg(v.leiras) : (v.leirasMd ?? ''),
      elofeltetelek: szoveg(tm.elofeltetelek),
      kriteriumok: szoveg(tm.kriteriumok),
      cia: cia ? `${cia.c ?? '-'}/${cia.i ?? '-'}/${cia.a ?? '-'}` : '',
      cimkek: e.cimkek ?? [],
      hatalyKezdet: nap(v.hatalyKezdet),
      hatalyVeg: nap(v.hatalyVeg),
      kapcsolatok: kapcsolatSzoveg(id),
      modositva: new Date((e as { updatedAt?: Date }).updatedAt ?? Date.now()).toISOString(),
    };
  });

  return {
    alkalmazas: { kod: alk.kod, nev: alk.nev, leiras: alk.leiras ?? '' },
    mod,
    generalva: new Date(),
    sorok,
    kapcsolatok: kapcs
      .filter((k) => k.celElemId && exportIdk.has(String(k.forrasElemId)) && exportIdk.has(String(k.celElemId)))
      .map((k) => ({
        id: String(k._id),
        forrasId: String(k.forrasElemId),
        celId: String(k.celElemId),
        fajta: k.fajta,
        modositva: new Date((k as { updatedAt?: Date }).updatedAt ?? Date.now()).toISOString(),
      })),
    gyerekek: fa.gyerekek,
    gyokerek: fa.gyokerek,
  };
}
