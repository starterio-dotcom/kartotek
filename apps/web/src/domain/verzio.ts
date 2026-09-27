import {
  elerhetoVerzioMuveletek,
  jogiZarolasTiltja,
  szabad,
  verzioSzerzoIds,
  VEGALLAPOTOK,
  type Muvelet,
  type Kontextus,
} from '@kartotek/shared';
import type { Elem, Verzio } from '../api/tipusok';
import type { Felhasznalo } from '../api/tipusok';

/** A verzió szerzői a négy-szem-elvhez — a `shared` szabálya, ugyanaz, mint a backenden. */
export function szerkesztoIds(verzio: Verzio): string[] {
  return verzioSzerzoIds(verzio);
}

export function vanUjabbAktivVerzio(elem: Elem, verzioSzam: number): boolean {
  return elem.verziok.some((v) => v.verzioSzam > verzioSzam && !VEGALLAPOTOK.includes(v.statusz));
}

/** A `shared` jogosultság + állapotgép alapján elérhető életciklus-műveletek a kontextusban. */
export function elerhetoMuveletek(
  elem: Elem,
  verzio: Verzio,
  felhasznalo: Felhasznalo,
): Muvelet[] {
  const ctx: Kontextus = {
    felhasznalo,
    alkalmazasKod: elem.alkalmazasKod,
    verzio: { statusz: verzio.statusz, szerkesztoIds: szerkesztoIds(verzio) },
    vanUjabbAktivVerzio: vanUjabbAktivVerzio(elem, verzio.verzioSzam),
  };
  // Jogi zárolás alatt a lezáró műveletek (elvetés, archiválás) gombja meg sem jelenik.
  return elerhetoVerzioMuveletek(ctx).filter((m) => !jogiZarolasTiltja(m, elem.jogiZarolas));
}

export type DialogTipus = 'nincs' | 'jovahagyas' | 'visszadobas' | 'kivezetes' | 'elvetes' | 'megerosites';

export interface MuveletUi {
  muvelet: Muvelet;
  cimke: string;
  akcio: string;
  dialog: DialogTipus;
  valtozat: 'elsodleges' | 'masodlagos' | 'veszelyes';
  /** Mi történik — a gomb tooltipje és a dialógus magyarázata. */
  leiras: string;
  /** A dialógus megerősítő gombjának felirata (műveletspecifikus, nem „OK"). */
  megerosito?: string;
}

/** Életciklus-művelet → felületi gomb (felirat, végpont, dialógus, magyarázat). */
export const MUVELET_UI: Record<Muvelet & string, MuveletUi | undefined> = {
  'verzió.beküldés': {
    muvelet: 'verzió.beküldés',
    cimke: 'Beküldés véleményezésre',
    akcio: 'bekuldes',
    dialog: 'nincs',
    valtozat: 'elsodleges',
    leiras: 'A verzió véleményezésre kerül, a jóváhagyók értesítést kapnak. Amíg vissza nem vonod, nem szerkeszthető.',
  },
  'verzió.visszavonás': {
    muvelet: 'verzió.visszavonás',
    cimke: 'Visszavonás',
    akcio: 'visszavonas',
    dialog: 'nincs',
    valtozat: 'masodlagos',
    leiras: 'A verziót visszaveszed a véleményezésből: újra Vázlat lesz, és szerkeszthető.',
  },
  'verzió.jóváhagyás': {
    muvelet: 'verzió.jóváhagyás',
    cimke: 'Jóváhagyás…',
    akcio: 'jovahagyas',
    dialog: 'jovahagyas',
    valtozat: 'elsodleges',
    leiras:
      'A verzió Jóváhagyott lesz, a tartalma véglegesen rögzül (módosítani csak új verzióval lehet). A hatálykezdet napján az ütemező Hatályossá lépteti.',
    megerosito: 'Jóváhagyás',
  },
  'verzió.visszadobás': {
    muvelet: 'verzió.visszadobás',
    cimke: 'Visszadobás…',
    akcio: 'visszadobas',
    dialog: 'visszadobas',
    valtozat: 'veszelyes',
    leiras: 'A verzió visszakerül a szerzőhöz Vázlatba. Az indoklást a szerző értesítésben és a naplóban látja.',
    megerosito: 'Visszadobás',
  },
  'verzió.elvetés': {
    muvelet: 'verzió.elvetés',
    cimke: 'Elvetés…',
    akcio: 'elvetes',
    dialog: 'elvetes',
    valtozat: 'veszelyes',
    leiras:
      'A verzió Elvetve végállapotba kerül: többé nem szerkeszthető és nem léptethető tovább. Az auditnyom megmarad.',
    megerosito: 'Elvetés',
  },
  'verzió.újverzió': {
    muvelet: 'verzió.újverzió',
    cimke: 'Új verzió nyitása (v+1)',
    akcio: 'ujverzio',
    dialog: 'nincs',
    valtozat: 'masodlagos',
    leiras: 'Új Vázlat-verzió nyílik a mostani tartalommal; a jelenlegi verzió változatlan marad.',
  },
  'verzió.kivezetés': {
    muvelet: 'verzió.kivezetés',
    cimke: 'Kivezetés…',
    akcio: 'kivezetes',
    dialog: 'kivezetes',
    valtozat: 'veszelyes',
    leiras: 'A megadott napon a verzió hatályát veszti: az ütemező Elavulttá lépteti. Utána archiválható.',
    megerosito: 'Kivezetés',
  },
  'verzió.archiválás': {
    muvelet: 'verzió.archiválás',
    cimke: 'Archiválás…',
    akcio: 'archivalas',
    dialog: 'megerosites',
    valtozat: 'veszelyes',
    leiras:
      'Az Archivált végállapot visszafordíthatatlan: nincs továbblépés és nincs visszaút. A tartalom és a napló változatlanul megőrződik, de a mindennapi nézetekből kikerül.',
    megerosito: 'Archiválás',
  },
} as Record<string, MuveletUi | undefined>;

const datumHu = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('hu-HU') : '—');

/** A sikeres életciklus-lépés visszajelzése (toast) — kulccsal és verzióval. */
export function lepesSikerSzoveg(akcio: string, elem: Elem, verzioSzam: number): string {
  const v = elem.verziok.find((x) => x.verzioSzam === verzioSzam);
  const kv = `${elem.kulcs} v${verzioSzam}`;
  switch (akcio) {
    case 'bekuldes':
      return `${kv} beküldve véleményezésre — a jóváhagyók értesítést kaptak.`;
    case 'visszavonas':
      return `${kv} visszavonva a véleményezésből — újra szerkeszthető Vázlat.`;
    case 'jovahagyas': // a magyar dátum ponttal zárul („2026. 09. 27.") — nem teszünk utána még egyet
      return `${kv} jóváhagyva — hatályba lép: ${datumHu(v?.hatalyKezdet)}`;
    case 'visszadobas':
      return `${kv} visszadobva a szerzőnek.`;
    case 'elvetes':
      return `${kv} elvetve.`;
    case 'ujverzio': {
      const uj = Math.max(...elem.verziok.map((x) => x.verzioSzam));
      return `Új verzió nyitva: ${elem.kulcs} v${uj} (Vázlat).`;
    }
    case 'kivezetes':
      return `${kv} kivezetve — hatályát veszti: ${datumHu(v?.hatalyVeg)}`;
    case 'archivalas':
      return `${kv} archiválva.`;
    default:
      return `${kv}: a lépés megtörtént.`;
  }
}

/**
 * Miért nincs (vagy miért nincs több) gomb? A felület soha ne hallgasson el egy hiányzó
 * műveletet: a négy-szem-elvet, a szerepkört, a végállapotot és az ütemezőt nevén nevezi.
 * `null`, ha a megjelenő gombok önmagukért beszélnek.
 */
export function muveletHint(elem: Elem, verzio: Verzio, felhasznalo: Felhasznalo, elerheto: Muvelet[]): string | null {
  const st = verzio.statusz;
  if (st === 'Archivált') return 'Archivált végállapot — nincs további életciklus-lépés.';
  if (st === 'Elvetve') return 'Elvetve végállapot — nincs további életciklus-lépés.';

  const alkalmazasKod = elem.alkalmazasKod;
  const szerepek = felhasznalo.tagsagok.filter((t) => t.alkalmazasKod === alkalmazasKod).map((t) => t.szerepkor);
  const csakOlvaso = !felhasznalo.globalisAdmin && szerepek.every((sz) => sz === 'Olvasó');

  if (st === 'Véleményezés' && !elerheto.includes('verzió.jóváhagyás')) {
    // Szerepköre alapján jóváhagyhatna (szerzők nélkül nézve) → csak a négy-szem-elv tiltja.
    const jovahagyoSzerep = szabad('verzió.jóváhagyás', {
      felhasznalo,
      alkalmazasKod,
      verzio: { statusz: st, szerkesztoIds: [] },
    });
    if (jovahagyoSzerep)
      return 'A saját (általad írt vagy beküldött) verziódat nem hagyhatod jóvá — négy-szem-elv. Egy másik jóváhagyó dönthet róla.';
    if (!csakOlvaso) return 'Véleményezésre vár — a jóváhagyó dönt róla.';
  }
  if (elerheto.length > 0) return null;

  if (csakOlvaso) return 'Olvasóként megtekintheted az elemet; léptetni Szerző, Jóváhagyó vagy Admin tud.';
  if ((st === 'Hatályos' || st === 'Jóváhagyott') && vanUjabbAktivVerzio(elem, verzio.verzioSzam)) {
    const uj = Math.max(...elem.verziok.map((v) => v.verzioSzam));
    return `Már van nyitott újabb verzió (v${uj}) — a módosítást ott folytathatod.`;
  }
  switch (st) {
    case 'Vázlat':
      return 'Vázlat — a szerző dolgozik rajta; beküldés után véleményezheted.';
    case 'Véleményezés':
      return 'Véleményezésre vár — a jóváhagyó dönt róla.';
    case 'Jóváhagyott':
      return `Jóváhagyva — ${datumHu(verzio.hatalyKezdet)} napján az ütemező Hatályossá lépteti.`;
    case 'Hatályos':
      return verzio.hatalyVeg
        ? `Hatályos — ${datumHu(verzio.hatalyVeg)} napján az ütemező Elavulttá lépteti.`
        : 'Hatályos, visszavonásig.';
    case 'Elavult':
      return 'Elavult — archiválni Admin tud.';
    default:
      return 'Ebben az állapotban nincs számodra elérhető lépés.';
  }
}
