import { hiba409 } from '../../hibak.js';
import { globalisAdminKell, type AktualisFelhasznalo } from '../../auth/plugin.js';
import { elemBetolt, elemValasz } from '../kozos.js';

/**
 * Jogi zárolás elrendelése / feloldása. Csak globális Admin, kötelező indoklással; a
 * lépés az elem append-only zárolási naplójába (és a kérés-szintű audit-naplóba) kerül.
 */
export async function jogiZarolasBeallit(
  id: string,
  be: { aktiv: boolean; ok: string },
  felh: AktualisFelhasznalo,
): Promise<Record<string, unknown>> {
  globalisAdminKell(felh);
  const elem = await elemBetolt(id);
  const jelenleg = !!elem.jogiZarolas?.aktiv;
  if (be.aktiv === jelenleg)
    throw hiba409(be.aktiv ? 'Az elem már jogi zárolás alatt áll.' : 'Az elem nincs jogi zárolás alatt.');

  const mikor = new Date();
  elem.set(
    'jogiZarolas',
    be.aktiv ? { aktiv: true, ok: be.ok, kiId: felh.id, kiNev: felh.nev, mikor } : null,
  );
  elem.jogiZarolasNaplo.push({
    muvelet: be.aktiv ? 'elrendelés' : 'feloldás',
    ok: be.ok,
    kiId: felh.id,
    kiNev: felh.nev,
    mikor,
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}
