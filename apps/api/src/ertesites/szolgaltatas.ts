import type { FastifyBaseLogger } from 'fastify';
import { Types } from 'mongoose';
import { verzioSzerzoIds } from '@kartotek/shared';
import { Ertesites, Felhasznalo } from '../db/modellek.js';
import { config } from '../config.js';
import type { AktualisFelhasznalo } from '../auth/plugin.js';
import { ertesitesSzoveg, type ErtesitesEsemeny } from './sablon.js';
import { emailEngedett, type EmailKuldo } from './email.js';

export interface EsemenyBe {
  esemeny: ErtesitesEsemeny;
  /** Az elem API-válasza (elemValasz) a művelet UTÁN. */
  elem: Record<string, unknown>;
  verzioSzam: number;
  felh: AktualisFelhasznalo;
  /** Indoklás / megjegyzés-szöveg / hatály. */
  reszlet?: string;
  /** Megjegyzés-válasznál a szülő megjegyzés azonosítója (a szerzője is értesül). */
  valaszMjid?: string;
}

type Verzio = {
  verzioSzam: number;
  cim: string;
  modositottaId?: unknown;
  szerkesztok?: unknown[];
  statusznaplo?: { honnan?: string | null; hova: string; ki: string }[];
  megjegyzesek?: { mjid: string; szerzoId: unknown }[];
};

const ervenyes = (x: unknown): x is string | Types.ObjectId => !!x && Types.ObjectId.isValid(String(x));

/**
 * A verzió szerzői — ugyanaz a `shared` szabály, mint a négy-szem-elvnél (a bíráló NEM szerző),
 * csak érvényes felhasználó-azonosítókra szűrve.
 */
function szerzok(v: Verzio): Set<string> {
  return new Set(verzioSzerzoIds(v).filter(ervenyes));
}

/**
 * Az alkalmazás döntéshozói: Jóváhagyó és (alkalmazás-)Admin tagok. Ha nincs ilyen,
 * a globális Adminok — hogy a beküldés sose maradjon címzett nélkül.
 */
async function jovahagyok(alkalmazasKod: string): Promise<Set<string>> {
  const tagok = await Felhasznalo.find({
    tagsagok: { $elemMatch: { alkalmazasKod, szerepkor: { $in: ['Jóváhagyó', 'Admin'] } } },
  })
    .select('_id')
    .lean();
  const lista = tagok.length ? tagok : await Felhasznalo.find({ globalisAdmin: true }).select('_id').lean();
  return new Set(lista.map((u) => String(u._id)));
}

const kivon = (a: Set<string>, b: Set<string>) => new Set([...a].filter((x) => !b.has(x)));

/**
 * Egy esemény címzettjei a spec szerint (velemenyezes-jovahagyas.md, Értesítések):
 *  - beküldés → az alkalmazás Jóváhagyói (a verzió saját szerzői nem: négy-szem-elv);
 *  - jóváhagyás / visszadobás → a Szerző(k);
 *  - megjegyzés → a másik fél (szerző írt → döntéshozók; döntéshozó írt → szerzők),
 *    válasznál a szülő megjegyzés szerzője is.
 * A művelet végrehajtója sosem kap értesítést a saját tettéről.
 */
export async function cimzettek(be: EsemenyBe, v: Verzio): Promise<Set<string>> {
  const sz = szerzok(v);
  const alk = String(be.elem.alkalmazasKod);
  let h: Set<string>;
  switch (be.esemeny) {
    case 'bekuldes':
      h = kivon(await jovahagyok(alk), sz);
      break;
    case 'jovahagyas':
    case 'visszadobas':
      h = sz;
      break;
    case 'megjegyzes':
      h = sz.has(be.felh.id) ? kivon(await jovahagyok(alk), sz) : new Set(sz);
      if (be.valaszMjid) {
        const szulo = v.megjegyzesek?.find((m) => m.mjid === be.valaszMjid);
        if (szulo && ervenyes(szulo.szerzoId)) h.add(String(szulo.szerzoId));
      }
      break;
  }
  h.delete(be.felh.id);
  return h;
}

/** Felületi értesítések létrehozása + (ha be van kapcsolva) e-mail. A címzettek számát adja. */
export async function ertesitesKeszit(be: EsemenyBe, kuldo: EmailKuldo, log: FastifyBaseLogger): Promise<number> {
  const v = (be.elem.verziok as Verzio[] | undefined)?.find((x) => x.verzioSzam === be.verzioSzam);
  if (!v) return 0;
  const idk = await cimzettek(be, v);
  if (!idk.size) return 0;

  const userek = await Felhasznalo.find({ _id: { $in: [...idk] } }).select('nev email').lean();
  const elemId = String(be.elem.id);
  const sz = ertesitesSzoveg({
    esemeny: be.esemeny,
    elemKulcs: String(be.elem.kulcs),
    verzioSzam: be.verzioSzam,
    cim: v.cim,
    kiNev: be.felh.nev,
    ...(be.reszlet ? { reszlet: be.reszlet } : {}),
    hivatkozas: `${config.alkalmazasUrl}/elem/${elemId}`,
  });

  await Ertesites.insertMany(
    userek.map((u) => ({
      cimzettId: u._id,
      esemeny: be.esemeny,
      elemId,
      elemKulcs: String(be.elem.kulcs),
      verzioSzam: be.verzioSzam,
      cim: v.cim,
      uzenet: sz.uzenet,
      kiId: be.felh.id,
      kiNev: be.felh.nev,
    })),
  );

  for (const u of userek) {
    if (!u.email || !emailEngedett(u.email)) continue;
    try {
      await kuldo.kuld({ cimzett: u.email, targy: sz.targy, szoveg: sz.szoveg, html: sz.html });
    } catch (err) {
      // Egy sikertelen levél ne akassza meg a többit; a felületi értesítés már megvan.
      log.warn({ err, cimzett: u.email }, 'Értesítő e-mail küldése sikertelen');
    }
  }
  return userek.length;
}

/** A felhasználó legutóbbi értesítései + az olvasatlanok száma. */
export async function ertesitesLista(felhId: string, limit: number) {
  const cimzettId = new Types.ObjectId(felhId);
  const [docs, olvasatlan] = await Promise.all([
    Ertesites.find({ cimzettId }).sort({ letrehozva: -1 }).limit(limit).lean(),
    Ertesites.countDocuments({ cimzettId, olvasva: null }),
  ]);
  return {
    ertesitesek: docs.map(({ _id, cimzettId: _c, elemId, kiId, ...r }) => ({
      id: String(_id),
      ...r,
      elemId: String(elemId),
      kiId: kiId ? String(kiId) : null,
    })),
    olvasatlan,
  };
}

/** Olvasottra állítás — csak a SAJÁT értesítéseken; `idk` nélkül mindet. */
export async function olvasottraAllit(felhId: string, idk?: string[]) {
  const cimzettId = new Types.ObjectId(felhId);
  const q: Record<string, unknown> = { cimzettId, olvasva: null };
  if (idk) q._id = { $in: idk.filter((i) => Types.ObjectId.isValid(i)).map((i) => new Types.ObjectId(i)) };
  await Ertesites.updateMany(q, { $set: { olvasva: new Date() } });
  return { olvasatlan: await Ertesites.countDocuments({ cimzettId, olvasva: null }) };
}
