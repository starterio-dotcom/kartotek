import type { Statusz } from '../tipusok.js';

export interface VerzioAuto {
  statusz: Statusz;
  hatalyKezdet: Date | null;
  hatalyVeg: Date | null;
}

export type AutoDontes =
  | { muvelet: 'hatálybalépés'; ujStatusz: 'Hatályos' }
  | { muvelet: 'elavulás'; ujStatusz: 'Elavult' };

/** Milyen automata átmenet esedékes egy verzióra a megadott napon (vagy egyik sem). */
export function esedekesAutoAtmenet(v: VerzioAuto, ma: Date): AutoDontes | null {
  if (v.statusz === 'Jóváhagyott' && v.hatalyKezdet && v.hatalyKezdet <= ma)
    return { muvelet: 'hatálybalépés', ujStatusz: 'Hatályos' };
  if (v.statusz === 'Hatályos' && v.hatalyVeg && v.hatalyVeg < ma)
    return { muvelet: 'elavulás', ujStatusz: 'Elavult' };
  return null;
}
