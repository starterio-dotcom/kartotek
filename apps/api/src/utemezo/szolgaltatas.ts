import { esedekesAutoAtmenet } from '@kartotek/shared';
import { Elem } from '../db/modellek.js';
import { naplozEsLeptet, type ElemHidratalt } from '../modulok/kozos.js';

export interface UtemezoEredmeny {
  valtozas: number;
  hatalybalepes: number;
  elavulas: number;
  /** Elemek, amelyeket a próbálkozások után sem sikerült léptetni (a következő futás pótolja). */
  hibas: number;
}

/** Ennyiszer próbáljuk újra egy elem léptetését párhuzamos módosítás (VersionError) esetén. */
const MAX_PROBA = 3;

/**
 * Egy elem esedékes átmeneteinek alkalmazása a memóriában (mentés nélkül).
 * 1) Jóváhagyott → Hatályos, ha a kezdődátum elérve; a korábbi Hatályos verzió
 *    Elavultba kerül, és a végdátuma az új kezdetére áll.
 * 2) Hatályos → Elavult, ha a végdátum lejárt.
 */
function elemLeptet(elem: ElemHidratalt, ma: Date): { hatalybalepes: number; elavulas: number } {
  let hatalybalepes = 0;
  let elavulas = 0;

  // 1) Hatálybalépés.
  for (const ver of elem.verziok) {
    const dontes = esedekesAutoAtmenet(
      { statusz: ver.statusz as never, hatalyKezdet: ver.hatalyKezdet ?? null, hatalyVeg: ver.hatalyVeg ?? null },
      ma,
    );
    if (dontes?.muvelet === 'hatálybalépés') {
      // A korábbi Hatályos verzió leváltása ugyanazon az elemen.
      for (const regi of elem.verziok) {
        if (regi !== ver && regi.statusz === 'Hatályos') {
          regi.hatalyVeg = ver.hatalyKezdet;
          naplozEsLeptet(regi, 'Elavult', 'RENDSZER', `leváltotta: v${ver.verzioSzam}`);
          elavulas++;
        }
      }
      naplozEsLeptet(ver, 'Hatályos', 'RENDSZER', 'kezdődátum elérve');
      ver.fagyasztva = ma; // a tartalom és a mellékletek befagynak
      hatalybalepes++;
    }
  }

  // 2) Elavulás (végdátum lejárt).
  for (const ver of elem.verziok) {
    const dontes = esedekesAutoAtmenet(
      { statusz: ver.statusz as never, hatalyKezdet: ver.hatalyKezdet ?? null, hatalyVeg: ver.hatalyVeg ?? null },
      ma,
    );
    if (dontes?.muvelet === 'elavulás') {
      naplozEsLeptet(ver, 'Elavult', 'RENDSZER', 'végdátum elérve');
      elavulas++;
    }
  }
  return { hatalybalepes, elavulas };
}

/**
 * Dátumvezérelt automata átmenetek léptetése (idempotens, `ki=RENDSZER`).
 *
 * Elemenként dolgozik: minden elemet frissen tölt, lépteti és menti. Ha közben egy
 * felhasználó ugyanazt az elemet módosította (optimista zár → VersionError), újratölt
 * és újrapróbál; egy elem tartós hibája nem szakítja meg a többi léptetését.
 */
export async function utemezoFut(ma: Date = new Date()): Promise<UtemezoEredmeny> {
  const eredmeny: UtemezoEredmeny = { valtozas: 0, hatalybalepes: 0, elavulas: 0, hibas: 0 };
  const jeloltek = await Elem.find({ 'verziok.statusz': { $in: ['Jóváhagyott', 'Hatályos'] } })
    .select('_id')
    .lean();

  for (const { _id } of jeloltek) {
    for (let proba = 1; ; proba++) {
      try {
        const elem = (await Elem.findById(_id)) as ElemHidratalt | null;
        if (!elem) break; // közben törölték
        const r = elemLeptet(elem, ma);
        if (r.hatalybalepes + r.elavulas > 0) await elem.save();
        eredmeny.hatalybalepes += r.hatalybalepes;
        eredmeny.elavulas += r.elavulas;
        break;
      } catch (e) {
        if ((e as Error).name === 'VersionError' && proba < MAX_PROBA) continue;
        eredmeny.hibas++;
        break;
      }
    }
  }

  eredmeny.valtozas = eredmeny.hatalybalepes + eredmeny.elavulas;
  return eredmeny;
}
