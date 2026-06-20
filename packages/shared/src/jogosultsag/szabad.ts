import type { Statusz, Szerepkor } from '../tipusok.js';
import { atmenet, type AtmenetMuvelet } from '../allapotgep/atmenetek.js';

/** Minden jogosultság-ellenőrzött művelet. */
export type Muvelet =
  | 'elem.olvasás'
  | 'elem.létrehozás'
  | 'vázlat.szerkesztés'
  | 'verzió.beküldés'
  | 'verzió.visszavonás'
  | 'verzió.jóváhagyás'
  | 'verzió.visszadobás'
  | 'verzió.elvetés'
  | 'verzió.újverzió'
  | 'verzió.kivezetés'
  | 'verzió.archiválás'
  | 'vázlat.törlés'
  | 'megjegyzés.írás'
  | 'megjegyzés.megoldás'
  | 'kapcsolat.kezelés'
  | 'címke.kezelés'
  | 'melléklet.kezelés'
  | 'kiadás.kezelés' // verzió kiadáshoz rendelése az alkalmazáson
  | 'szolgáltatás.kezelés' // szolgáltatás/alkalmazás CRUD — csak globális Admin
  | 'alkalmazás.metaadat' // saját alkalmazás metaadata — alkalmazás-Admin
  | 'tagság.kezelés'; // szerepkör-kiosztás az alkalmazáson

export interface FelhasznaloCtx {
  id: string;
  globalisAdmin: boolean;
  tagsagok: { alkalmazasKod: string; szerepkor: Szerepkor }[];
}

export interface VerzioCtx {
  statusz: Statusz;
  /** A verzió szerzői/szerkesztői — a négy-szem-elvhez. */
  szerkesztoIds: string[];
}

export interface Kontextus {
  felhasznalo: FelhasznaloCtx;
  /** Az alkalmazás hatóköre (elem-szintű műveleteknél kötelező). */
  alkalmazasKod?: string;
  /** Az érintett verzió (életciklus-műveleteknél). */
  verzio?: VerzioCtx;
  /** Új verzió nyitásához: van-e már újabb aktív verzió az elemen. */
  vanUjabbAktivVerzio?: boolean;
}

/** Alap-mátrix: mely szerepkörök engedélyezik a műveletet (lásd docs/szerepkorok-jogosultsagok.md). */
const MUVELET_SZEREPEK: Record<Muvelet, readonly Szerepkor[]> = {
  'elem.olvasás': ['Olvasó', 'Szerző', 'Jóváhagyó', 'Admin'],
  'elem.létrehozás': ['Szerző', 'Admin'],
  'vázlat.szerkesztés': ['Szerző', 'Admin'],
  'verzió.beküldés': ['Szerző', 'Admin'],
  'verzió.visszavonás': ['Szerző', 'Admin'],
  'verzió.jóváhagyás': ['Jóváhagyó', 'Admin'],
  'verzió.visszadobás': ['Jóváhagyó', 'Admin'],
  'verzió.elvetés': ['Szerző', 'Admin'],
  'verzió.újverzió': ['Szerző', 'Admin'],
  'verzió.kivezetés': ['Admin'],
  'verzió.archiválás': ['Admin'],
  'vázlat.törlés': ['Admin'],
  'megjegyzés.írás': ['Szerző', 'Jóváhagyó', 'Admin'],
  'megjegyzés.megoldás': ['Szerző', 'Jóváhagyó', 'Admin'],
  'kapcsolat.kezelés': ['Szerző', 'Admin'],
  'címke.kezelés': ['Szerző', 'Admin'],
  'melléklet.kezelés': ['Szerző', 'Admin'],
  'kiadás.kezelés': ['Szerző', 'Admin'],
  'szolgáltatás.kezelés': [], // csak globalisAdmin (lent rövidre zárva)
  'alkalmazás.metaadat': ['Admin'],
  'tagság.kezelés': ['Admin'], // saját alkalmazásra; rendszerszintű a globalisAdmin
};

/** Életciklus-művelet → állapotgép-művelet (a státusz-előfeltételhez). */
const ELETCIKLUS: Partial<Record<Muvelet, AtmenetMuvelet>> = {
  'verzió.beküldés': 'beküldés',
  'verzió.visszavonás': 'visszavonás',
  'verzió.jóváhagyás': 'jóváhagyás',
  'verzió.visszadobás': 'visszadobás',
  'verzió.elvetés': 'elvetés',
  'verzió.újverzió': 'újverzió',
  'verzió.kivezetés': 'kivezetés',
  'verzió.archiválás': 'archiválás',
};

/** A felhasználó szerepkörei az adott alkalmazáson (globalisAdmin nélkül). */
function szerepek(f: FelhasznaloCtx, alkalmazasKod?: string): Szerepkor[] {
  if (!alkalmazasKod) return [];
  return f.tagsagok.filter((t) => t.alkalmazasKod === alkalmazasKod).map((t) => t.szerepkor);
}

/**
 * Eldönti, hogy a felhasználó az adott kontextusban végrehajthatja-e a műveletet.
 * EGYETLEN igazság: ezt hívja a frontend (gomb-állapot) és a backend (kényszerítés) is.
 */
export function szabad(muvelet: Muvelet, ctx: Kontextus): boolean {
  const f = ctx.felhasznalo;

  // 1) Rendszerszintű művelet: kizárólag globális Admin.
  if (muvelet === 'szolgáltatás.kezelés') return f.globalisAdmin;

  // 2) Szerepkör-ellenőrzés (alap-mátrix) az alkalmazás hatókörében; a globális Admin átmegy.
  const engedelyezett = MUVELET_SZEREPEK[muvelet];
  const szerepRendben =
    f.globalisAdmin || szerepek(f, ctx.alkalmazasKod).some((sz) => engedelyezett.includes(sz));
  if (!szerepRendben) return false;

  // 3) Életciklus-műveleteknél: státusz-előfeltétel + speciális szabályok.
  const eletciklus = ELETCIKLUS[muvelet];
  if (eletciklus) {
    if (!ctx.verzio) return false;
    const at = atmenet(ctx.verzio.statusz, eletciklus);
    if (!at) return false; // ebből a státuszból nincs ilyen átmenet

    // 3a) Új verzió: csak ha nincs még újabb aktív verzió az elemen.
    if (eletciklus === 'újverzió' && ctx.vanUjabbAktivVerzio) return false;

    // 3b) Négy-szem-elv (jóváhagyás): a szerző/szerkesztő nem hagyhatja jóvá — a globális Adminra is áll.
    if (at.negySzem && ctx.verzio.szerkesztoIds.includes(f.id)) return false;
  }

  return true;
}

/** A felületen az adott verzión elérhető életciklus-műveletek a kontextusban. */
export function elerhetoVerzioMuveletek(ctx: Kontextus): Muvelet[] {
  if (!ctx.verzio) return [];
  return (Object.keys(ELETCIKLUS) as Muvelet[]).filter((m) => szabad(m, ctx));
}
