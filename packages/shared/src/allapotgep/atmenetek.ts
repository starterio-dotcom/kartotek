import type { Statusz, Szerepkor } from '../tipusok.js';

/** Verzió-művelet, ami státuszátmenetet vagy új verziót eredményez. */
export type AtmenetMuvelet =
  | 'beküldés'
  | 'visszavonás'
  | 'jóváhagyás'
  | 'visszadobás'
  | 'elvetés'
  | 'újverzió'
  | 'kivezetés'
  | 'archiválás'
  | 'hatálybalépés' // AUTO (ütemező)
  | 'elavulás'; // AUTO (ütemező)

export interface Atmenet {
  muvelet: AtmenetMuvelet;
  honnan: Statusz;
  /** A cél státusz. `null`, ha a művelet NEM ezt a verziót lépteti (lásd `ujVerzio`). */
  hova: Statusz | null;
  /** Ki válthatja ki: szerepkör vagy az ütemező (RENDSZER). */
  mod: Szerepkor | 'RENDSZER';
  /** Igaz, ha ÚJ verziót nyit Vázlatban; a forrásverzió státusza NEM változik. */
  ujVerzio?: boolean;
  /** Kötelező indoklás (pl. visszadobás). */
  indoklasKell?: boolean;
  /** Hatályossági dátum megadása kötelező (jóváhagyás). */
  hatalyKell?: boolean;
  /** Négy-szem-elv vonatkozik rá (jóváhagyás). */
  negySzem?: boolean;
  /** Megerősítést igénylő, „veszélyes” művelet. */
  veszelyes?: boolean;
}

/** A teljes állapotgép — egyetlen igazság a verzió-életciklushoz. */
export const ATMENETEK = [
  { muvelet: 'beküldés', honnan: 'Vázlat', hova: 'Véleményezés', mod: 'Szerző' },
  { muvelet: 'visszavonás', honnan: 'Véleményezés', hova: 'Vázlat', mod: 'Szerző' },
  {
    muvelet: 'visszadobás',
    honnan: 'Véleményezés',
    hova: 'Vázlat',
    mod: 'Jóváhagyó',
    indoklasKell: true,
    veszelyes: true,
  },
  {
    muvelet: 'jóváhagyás',
    honnan: 'Véleményezés',
    hova: 'Jóváhagyott',
    mod: 'Jóváhagyó',
    hatalyKell: true,
    negySzem: true,
  },
  { muvelet: 'elvetés', honnan: 'Vázlat', hova: 'Elvetve', mod: 'Szerző', veszelyes: true },
  { muvelet: 'újverzió', honnan: 'Jóváhagyott', hova: null, mod: 'Szerző', ujVerzio: true },
  { muvelet: 'újverzió', honnan: 'Hatályos', hova: null, mod: 'Szerző', ujVerzio: true },
  { muvelet: 'kivezetés', honnan: 'Hatályos', hova: 'Elavult', mod: 'Admin', veszelyes: true },
  { muvelet: 'archiválás', honnan: 'Elavult', hova: 'Archivált', mod: 'Admin' },
  // Automata átmenetek (az ütemező lépteti, dátum alapján):
  { muvelet: 'hatálybalépés', honnan: 'Jóváhagyott', hova: 'Hatályos', mod: 'RENDSZER' },
  { muvelet: 'elavulás', honnan: 'Hatályos', hova: 'Elavult', mod: 'RENDSZER' },
] as const satisfies readonly Atmenet[];

export const VEGALLAPOTOK: readonly Statusz[] = ['Archivált', 'Elvetve'];
export const AUTO_ATMENETEK: readonly Atmenet[] = ATMENETEK.filter((a) => a.mod === 'RENDSZER');

/** Az adott státuszhoz és művelethez tartozó átmenet (vagy `undefined`). */
export function atmenet(honnan: Statusz, muvelet: AtmenetMuvelet): Atmenet | undefined {
  return ATMENETEK.find((a) => a.honnan === honnan && a.muvelet === muvelet);
}

/** Egy státuszból kézzel (nem AUTO) elérhető átmenetek. */
export function keziAtmenetek(honnan: Statusz): Atmenet[] {
  return ATMENETEK.filter((a) => a.honnan === honnan && a.mod !== 'RENDSZER');
}

export function vegallapot(statusz: Statusz): boolean {
  return VEGALLAPOTOK.includes(statusz);
}
