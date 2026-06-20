import type { Statusz, TipusKod, RetegKod, KapcsolatFajta } from '@kartotek/shared';
import { Elem, Kapcsolat } from '../../db/modellek.js';
import { hiba403 } from '../../hibak.js';

export interface GrafCsomopont {
  id: string;
  kulcs: string;
  tipusKod: TipusKod;
  retegKod: RetegKod | null;
  alkalmazasKod: string;
  statusz: Statusz;
}

export interface GrafEl {
  id: string;
  forras: string;
  cel: string; // elem _id, vagy 'sz:<szabalyzatKod>'
  fajta: KapcsolatFajta;
}

export interface Graf {
  csomopontok: GrafCsomopont[];
  szabalyzatok: string[];
  elek: GrafEl[];
}

/** A legmagasabb verziószámú verzió státusza (a listához hasonlóan). */
function foStatusz(verziok: { verzioSzam: number; statusz: string }[]): Statusz {
  const v = verziok.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), verziok[0]!);
  return (v?.statusz ?? 'Vázlat') as Statusz;
}

/** A kapcsolati gráf adatai, az olvasási hatókörre szűrve. */
export async function grafLekeres(
  lathatoAlkalmazasok: string[] | 'mind',
  alkalmazasKod?: string,
): Promise<Graf> {
  if (
    alkalmazasKod &&
    lathatoAlkalmazasok !== 'mind' &&
    !lathatoAlkalmazasok.includes(alkalmazasKod)
  )
    throw hiba403('Nincs olvasási jogosultság ehhez az alkalmazáshoz.');

  const q: Record<string, unknown> = {};
  if (alkalmazasKod) q.alkalmazasKod = alkalmazasKod;
  else if (lathatoAlkalmazasok !== 'mind') q.alkalmazasKod = { $in: lathatoAlkalmazasok };

  const elemek = await Elem.find(q).lean();
  const idSet = new Set(elemek.map((e) => String(e._id)));
  const csomopontok: GrafCsomopont[] = elemek.map((e) => ({
    id: String(e._id),
    kulcs: e.kulcs,
    tipusKod: e.tipusKod as TipusKod,
    retegKod: (e.retegKod as RetegKod | null) ?? null,
    alkalmazasKod: e.alkalmazasKod,
    statusz: foStatusz(e.verziok),
  }));

  const nyersElek = await Kapcsolat.find({
    forrasElemId: { $in: elemek.map((e) => e._id) },
  }).lean();

  const elek: GrafEl[] = [];
  const szabalyzatok = new Set<string>();
  for (const k of nyersElek) {
    const forras = String(k.forrasElemId);
    if (k.celElemId) {
      const cel = String(k.celElemId);
      if (idSet.has(cel)) elek.push({ id: String(k._id), forras, cel, fajta: k.fajta as KapcsolatFajta });
      // hatókörön kívüli (másik alkalmazás) cél: kihagyjuk
    } else if (k.celSzabalyzatKod) {
      szabalyzatok.add(k.celSzabalyzatKod);
      elek.push({
        id: String(k._id),
        forras,
        cel: `sz:${k.celSzabalyzatKod}`,
        fajta: k.fajta as KapcsolatFajta,
      });
    }
    // külső link: nincs csomópont, kihagyjuk
  }

  return { csomopontok, szabalyzatok: [...szabalyzatok], elek };
}
