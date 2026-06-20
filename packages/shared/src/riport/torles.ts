import type { Statusz } from '../tipusok.js';

/** A fizikai törlés eldöntéséhez szükséges kontextus (a hívó tölti a DB-ből). */
export interface TorlesCtx {
  /** Az elem összes verziójának státusza. */
  verziok: { statusz: Statusz }[];
  /** Hány másik elem hivatkozik erre (bejövő kapcsolatok száma). */
  bejovoKapcsolatok: number;
  /** Hány kimenő kapcsolata van az elemnek. */
  kimenoKapcsolatok: number;
}

export interface TorlesDontes {
  /** Fizikailag törölhető-e az elem. */
  torolheto: boolean;
  /** Ha nem törölhető: mind az indok(ok). */
  okok: string[];
  /** Helyette ajánlott, auditbiztos művelet (ha nem törölhető). */
  ajanlott: 'elvetés' | 'archiválás' | null;
}

/**
 * Eldönti, hogy egy elem fizikailag törölhető-e (állami auditelv: alapból nincs
 * kemény törlés). Csak sosem hivatkozott, minden verziójában Vázlat elemnél
 * engedélyezett; egyébként az Elvetve/Archivált végállapot a járható út.
 * Tiszta függvény — a FE (gomb-állapot) és a BE (kényszerítés) is ezt hívja.
 */
export function torolhetoE(ctx: TorlesCtx): TorlesDontes {
  const okok: string[] = [];
  const csakVazlat =
    ctx.verziok.length > 0 && ctx.verziok.every((v) => v.statusz === 'Vázlat');

  if (ctx.verziok.length === 0) {
    okok.push('Az elemnek nincs verziója.');
  } else if (!csakVazlat) {
    okok.push(
      'Az elem már túllépett a Vázlat állapoton — az auditnyom megőrzése miatt fizikailag nem törölhető.',
    );
  }
  if (ctx.bejovoKapcsolatok > 0)
    okok.push(
      `Az elemre ${ctx.bejovoKapcsolatok} másik elem hivatkozik — előbb szüntesd meg a bejövő kapcsolatokat.`,
    );
  if (ctx.kimenoKapcsolatok > 0)
    okok.push(
      `Az elemnek ${ctx.kimenoKapcsolatok} kimenő kapcsolata van — előbb töröld ezeket.`,
    );

  const torolheto = okok.length === 0;
  return {
    torolheto,
    okok,
    ajanlott: torolheto ? null : csakVazlat ? 'elvetés' : 'archiválás',
  };
}
