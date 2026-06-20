import { SZEREPKOROK } from '@kartotek/shared';
import { useFelhasznalok, useAlkalmazasok, useFelhasznaloFrissites } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { Betolto } from '../komponens/ui';
import type { Felhasznalo } from '../api/tipusok';

/** Admin-felület a felhasználói szerepkörökhöz (tagság alkalmazásonként + globális Admin). */
export function Felhasznalok() {
  const { felhasznalo } = useAuth();
  const { data: userek, isLoading } = useFelhasznalok();
  const { data: alkalmazasok } = useAlkalmazasok();
  const frissit = useFelhasznaloFrissites();

  if (!felhasznalo?.globalisAdmin)
    return (
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Felhasználók</h2>
        <div className="reszlet-altipus">Ehhez globális Admin jogosultság kell.</div>
      </div>
    );
  if (isLoading) return <Betolto />;
  const apps = alkalmazasok ?? [];

  const szerepValt = (u: Felhasznalo, alkKod: string, szerep: string) => {
    const tagsagok = (u.tagsagok ?? []).filter((t) => t.alkalmazasKod !== alkKod);
    if (szerep) tagsagok.push({ alkalmazasKod: alkKod, szerepkor: szerep as never });
    frissit.mutate({ id: u.id, tagsagok });
  };

  return (
    <>
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Felhasználók</h2>
        <div className="reszlet-altipus">
          Szerepkörök alkalmazásonként + globális Admin. A változás azonnal mentődik.
        </div>
      </div>
      <div className="blokk">
        <table className="felh-tabla">
          <thead>
            <tr>
              <th>Név</th>
              <th>Email</th>
              <th>Globális Admin</th>
              {apps.map((a) => (
                <th key={a.kod}>{a.kod}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(userek ?? []).map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.nev}</b>
                </td>
                <td className="felh-email">{u.email}</td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={u.globalisAdmin}
                    disabled={frissit.isPending}
                    onChange={(e) => frissit.mutate({ id: u.id, globalisAdmin: e.target.checked })}
                    aria-label={`${u.nev} — globális Admin`}
                  />
                </td>
                {apps.map((a) => {
                  const akt = u.tagsagok?.find((t) => t.alkalmazasKod === a.kod)?.szerepkor ?? '';
                  return (
                    <td key={a.kod}>
                      <select
                        value={akt}
                        disabled={frissit.isPending}
                        onChange={(e) => szerepValt(u, a.kod, e.target.value)}
                        aria-label={`${u.nev} szerepköre — ${a.kod}`}
                      >
                        <option value="">—</option>
                        {SZEREPKOROK.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
