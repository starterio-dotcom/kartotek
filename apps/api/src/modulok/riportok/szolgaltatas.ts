import { Types } from 'mongoose';
import {
  hatasElemzes,
  lefedetlenBus,
  type TipusKod,
  type RetegKod,
  type Statusz,
} from '@kartotek/shared';
import { Elem, Kapcsolat, Szabalyzat } from '../../db/modellek.js';
import { hiba403, hiba404 } from '../../hibak.js';
import { ervenyesId } from '../kozos.js';

type Hatokor = string[] | 'mind';

/** Az alkalmazás-szűrő összeállítása az olvasási hatókörrel (mint a gráfnál). */
function hatokorSzuro(lathato: Hatokor, alkalmazasKod?: string): Record<string, unknown> {
  if (alkalmazasKod) {
    if (lathato !== 'mind' && !lathato.includes(alkalmazasKod))
      throw hiba403('Nincs olvasási jogosultság ehhez az alkalmazáshoz.');
    return { alkalmazasKod };
  }
  return lathato === 'mind' ? {} : { alkalmazasKod: { $in: lathato } };
}

interface ElemFej {
  id: string;
  kulcs: string;
  cim: string;
  tipusKod: TipusKod;
  retegKod: RetegKod | null;
  alkalmazasKod: string;
}

/** A legmagasabb verziószámú verzió címe (lista-szerű fő nézet). */
function foCim(verziok: { verzioSzam: number; cim: string }[]): string {
  const v = verziok.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), verziok[0]!);
  return v?.cim ?? '';
}

async function scopeElemek(szuro: Record<string, unknown>): Promise<ElemFej[]> {
  const docs = await Elem.find(szuro).select('kulcs tipusKod retegKod alkalmazasKod verziok.verzioSzam verziok.cim').sort({ kulcs: 1 }).lean();
  return docs.map((e) => ({
    id: String(e._id),
    kulcs: e.kulcs,
    cim: foCim(e.verziok),
    tipusKod: e.tipusKod as TipusKod,
    retegKod: (e.retegKod as RetegKod | null) ?? null,
    alkalmazasKod: e.alkalmazasKod,
  }));
}

/* ---------- Lefedettség-riport ---------- */

export interface LefedettsegRiport {
  osszesBus: number;
  fedetlenek: ElemFej[];
}

/** Mely BUS-okhoz nincs (közvetve) TUS a `lebontja`-fán. */
export async function lefedettsegRiport(
  lathato: Hatokor,
  alkalmazasKod?: string,
): Promise<LefedettsegRiport> {
  const szuro = hatokorSzuro(lathato, alkalmazasKod);
  const elemek = await scopeElemek(szuro);
  const idSet = new Set(elemek.map((e) => e.id));

  const lebontjaNyers = await Kapcsolat.find({ fajta: 'lebontja', celElemId: { $ne: null } })
    .select('forrasElemId celElemId')
    .lean();
  const lebontja = lebontjaNyers.map((e) => ({
    forras: String(e.forrasElemId),
    cel: String(e.celElemId),
  }));

  const fedetlenIds = new Set(
    lefedetlenBus(elemek.map((e) => ({ id: e.id, tipusKod: e.tipusKod })), lebontja),
  );
  // A scope-on kívüli leszármazottak is számítanak a lefedettségbe, de a
  // visszaadott „fedetlen” lista a scope BUS-aira szorítkozik.
  void idSet;

  const osszesBus = elemek.filter((e) => e.tipusKod === 'BUS').length;
  return { osszesBus, fedetlenek: elemek.filter((e) => fedetlenIds.has(e.id)) };
}

/* ---------- Megfelelés-riport ---------- */

export interface MegfelelesTetel {
  kod: string;
  nev: string;
  url: string;
  megfelelok: ElemFej[];
}

/** A `megfelel → Szabályzat` kapcsolatokból: szabályzatonként a megfelelő elemek. */
export async function megfelelesRiport(
  lathato: Hatokor,
  alkalmazasKod?: string,
): Promise<MegfelelesTetel[]> {
  const szuro = hatokorSzuro(lathato, alkalmazasKod);
  const elemek = await scopeElemek(szuro);
  const elemMap = new Map(elemek.map((e) => [e.id, e]));

  const megfelelEk = await Kapcsolat.find({
    fajta: 'megfelel',
    celSzabalyzatKod: { $ne: null },
    forrasElemId: { $in: elemek.map((e) => new Types.ObjectId(e.id)) },
  })
    .select('forrasElemId celSzabalyzatKod')
    .lean();

  const szabalyzatok = await Szabalyzat.find().sort({ kod: 1 }).lean();
  const tetelek = new Map<string, MegfelelesTetel>();
  for (const sz of szabalyzatok)
    tetelek.set(sz.kod, { kod: sz.kod, nev: sz.nev, url: sz.url, megfelelok: [] });

  for (const k of megfelelEk) {
    const kod = k.celSzabalyzatKod!;
    const elem = elemMap.get(String(k.forrasElemId));
    let tetel = tetelek.get(kod);
    if (!tetel) {
      // A kapcsolat ismeretlen szabályzatra mutat — jelenítsük meg minimálisan.
      tetel = { kod, nev: kod, url: '', megfelelok: [] };
      tetelek.set(kod, tetel);
    }
    if (elem) tetel.megfelelok.push(elem);
  }

  return [...tetelek.values()];
}

/* ---------- Hatáselemzés ---------- */

export interface HatasElem extends ElemFej {
  melyseg: number;
  statusz: Statusz;
}

export interface HatasRiport {
  elem: ElemFej;
  /** Amit a vizsgált elem (közvetve) lebont / amitől függ. */
  lefele: HatasElem[];
  /** Ami a vizsgált elemet lebontja / ami tőle függ (a változás ezeket érinti). */
  felfele: HatasElem[];
}

/** Hatáselemzés egy elemre a `lebontja`/`függ tőle` éleken (mindkét irány). */
export async function hatasRiport(id: string, lathato: Hatokor): Promise<HatasRiport> {
  if (!ervenyesId(id)) throw hiba404('Elem nem található');
  const kozep = await Elem.findById(id).lean();
  if (!kozep) throw hiba404('Elem nem található');
  if (lathato !== 'mind' && !lathato.includes(kozep.alkalmazasKod))
    throw hiba403('Nincs olvasási jogosultság ehhez az alkalmazáshoz.');

  const elek = await Kapcsolat.find({ fajta: { $in: ['lebontja', 'függ tőle'] }, celElemId: { $ne: null } })
    .select('forrasElemId celElemId')
    .lean();
  const h = hatasElemzes(
    id,
    elek.map((e) => ({ forras: String(e.forrasElemId), cel: String(e.celElemId) })),
  );

  // Az érintett elemek fejléceit egy lekérdezéssel töltjük be.
  const erintettIds = [...h.lefele, ...h.felfele].map((x) => x.id);
  const docs = await Elem.find({ _id: { $in: erintettIds.map((x) => new Types.ObjectId(x)) } })
    .select('kulcs tipusKod retegKod alkalmazasKod verziok.verzioSzam verziok.cim verziok.statusz')
    .lean();
  const fejMap = new Map(
    docs.map((e) => {
      const v = e.verziok.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), e.verziok[0]!);
      return [
        String(e._id),
        {
          id: String(e._id),
          kulcs: e.kulcs,
          cim: v?.cim ?? '',
          tipusKod: e.tipusKod as TipusKod,
          retegKod: (e.retegKod as RetegKod | null) ?? null,
          alkalmazasKod: e.alkalmazasKod,
          statusz: (v?.statusz ?? 'Vázlat') as Statusz,
        },
      ];
    }),
  );

  // A hatáslista az olvasási hatókörre szorítkozik (a más alkalmazásbeli érintett
  // elemeket nem szivárogtatjuk ki — a központi elem már átment a hatókör-ellenőrzésen).
  const fel = (lista: { id: string; melyseg: number }[]): HatasElem[] =>
    lista
      .map((x) => {
        const f = fejMap.get(x.id);
        if (!f) return null;
        if (lathato !== 'mind' && !lathato.includes(f.alkalmazasKod)) return null;
        return { ...f, melyseg: x.melyseg };
      })
      .filter((x): x is HatasElem => x !== null);

  const kozV = kozep.verziok.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), kozep.verziok[0]!);
  return {
    elem: {
      id,
      kulcs: kozep.kulcs,
      cim: kozV?.cim ?? '',
      tipusKod: kozep.tipusKod as TipusKod,
      retegKod: (kozep.retegKod as RetegKod | null) ?? null,
      alkalmazasKod: kozep.alkalmazasKod,
    },
    lefele: fel(h.lefele),
    felfele: fel(h.felfele),
  };
}
