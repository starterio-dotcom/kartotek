import { esedekesAutoAtmenet } from '@kartotek/shared';
import { Elem } from '../db/modellek.js';
import { naplozEsLeptet } from '../modulok/kozos.js';

export interface UtemezoEredmeny {
  valtozas: number;
  hatalybalepes: number;
  elavulas: number;
}

/**
 * Dátumvezérelt automata átmenetek léptetése (idempotens, `ki=RENDSZER`).
 * 1) Jóváhagyott → Hatályos, ha a kezdődátum elérve; a korábbi Hatályos verzió
 *    Elavultba kerül, és a végdátuma az új kezdetére áll.
 * 2) Hatályos → Elavult, ha a végdátum lejárt.
 * A verziók egy elem-dokumentumba ágyazottak → az elemenkénti írás atomi.
 */
export async function utemezoFut(ma: Date = new Date()): Promise<UtemezoEredmeny> {
  const eredmeny: UtemezoEredmeny = { valtozas: 0, hatalybalepes: 0, elavulas: 0 };
  const elemek = await Elem.find({
    'verziok.statusz': { $in: ['Jóváhagyott', 'Hatályos'] },
  });

  for (const elem of elemek) {
    let valtozott = false;

    // 1) Hatálybalépés.
    for (const ver of elem.verziok) {
      const dontes = esedekesAutoAtmenet(
        {
          statusz: ver.statusz as never,
          hatalyKezdet: ver.hatalyKezdet ?? null,
          hatalyVeg: ver.hatalyVeg ?? null,
        },
        ma,
      );
      if (dontes?.muvelet === 'hatálybalépés') {
        // A korábbi Hatályos verzió leváltása ugyanazon az elemen.
        for (const regi of elem.verziok) {
          if (regi !== ver && regi.statusz === 'Hatályos') {
            regi.hatalyVeg = ver.hatalyKezdet;
            naplozEsLeptet(regi, 'Elavult', 'RENDSZER', `leváltotta: v${ver.verzioSzam}`);
            eredmeny.elavulas++;
          }
        }
        naplozEsLeptet(ver, 'Hatályos', 'RENDSZER', 'kezdődátum elérve');
        ver.fagyasztva = ma; // a tartalom és a mellékletek befagynak
        eredmeny.hatalybalepes++;
        valtozott = true;
      }
    }

    // 2) Elavulás (végdátum lejárt).
    for (const ver of elem.verziok) {
      const dontes = esedekesAutoAtmenet(
        {
          statusz: ver.statusz as never,
          hatalyKezdet: ver.hatalyKezdet ?? null,
          hatalyVeg: ver.hatalyVeg ?? null,
        },
        ma,
      );
      if (dontes?.muvelet === 'elavulás') {
        naplozEsLeptet(ver, 'Elavult', 'RENDSZER', 'végdátum elérve');
        eredmeny.elavulas++;
        valtozott = true;
      }
    }

    if (valtozott) await elem.save();
  }

  eredmeny.valtozas = eredmeny.hatalybalepes + eredmeny.elavulas;
  return eredmeny;
}
