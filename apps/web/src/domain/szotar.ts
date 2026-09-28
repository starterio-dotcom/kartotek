import type { KapcsolatFajta, RetegKod, TipusKod } from '@kartotek/shared';

/** A domain-fogalmak felhasználói nevei és rövid magyarázatai — egyetlen helyen. */

export const TIPUS_NEV: Record<TipusKod, string> = {
  BUS: 'Üzleti User Story',
  TUC: 'Technikai Use Case',
  F: 'Feature',
  TUS: 'Technikai User Story',
  BD: 'Üzleti dokumentum',
  TD: 'Technikai dokumentum',
};

export const tipusCimke = (k: TipusKod) => `${k} — ${TIPUS_NEV[k] ?? k}`;

export const RETEG_NEV: Record<RetegKod, string> = {
  FE: 'Frontend',
  Core: 'Core',
  TAPI: 'Technikai API',
  TDB: 'Technikai adatbázis',
};

export const retegCimke = (k: RetegKod) => (RETEG_NEV[k] && RETEG_NEV[k] !== k ? `${k} — ${RETEG_NEV[k]}` : k);

/** A kapcsolatfajták iránya és jelentése (docs/kapcsolatok.md). */
export const KAPCSOLAT_LEIRAS: Record<KapcsolatFajta, string> = {
  lebontja: 'részletesebb elemekre bontja — a cél a forrás része (hierarchia; lefedettség és hatáselemzés alapja)',
  'függ tőle': 'megvalósításához szükséges a cél (sorrend és kockázat)',
  hivatkozik: 'informálisan hivatkozik a célra (dokumentum vagy külső link)',
  megfelel: 'megfelel a cél szabályzatnak (megfelelés-riport)',
  leváltja: 'leváltja a céljául megadott, azonos típusú elemet (kivezetés követése)',
};

/** Típusonkénti kiinduló sablon a részletes leíráshoz (markdown). */
export const LEIRAS_SABLON: Record<TipusKod, string> = {
  BUS: 'Mint **[szerep]** szeretném **[cél]**, azért, hogy **[érték]**.\n',
  TUS: '**Cél:** …\n\n**Megoldás vázlata:** …\n',
  TUC: '**Szereplők:** …\n\n**Fő forgatókönyv:**\n1. …\n2. …\n\n**Alternatív ágak:** …\n',
  F: '**Leírás:** …\n\n**Érintett felületek / komponensek:** …\n',
  BD: '**Cél és hatókör:** …\n\n**Tartalom:** …\n',
  TD: '**Cél és hatókör:** …\n\n**Műszaki tartalom:** …\n',
};

/** A dokumentum-típusok CIA-besorolást kapnak (a prototípus szerint alapból 1/1/1). */
export const dokumentumTipus = (k: TipusKod) => k === 'BD' || k === 'TD';
export const CIA_ALAP = { c: 1, i: 1, a: 1 };
export const CIA_SZINTEK = [1, 2, 3, 4] as const;
