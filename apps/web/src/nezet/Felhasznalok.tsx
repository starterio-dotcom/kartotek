import { useState } from 'react';
import { SZEREPKOROK } from '@kartotek/shared';
import { useFelhasznalok, useAlkalmazasok, useFelhasznaloFrissites } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { uzenet } from '../allapot/uzenetek';
import { Betolto, Megerosites } from '../komponens/ui';
import type { FelhasznaloListaTetel } from '../api/tipusok';

/** Admin-felület a felhasználói szerepkörökhöz (tagság alkalmazásonként + globális Admin). */
export function Felhasznalok() {
  const { felhasznalo } = useAuth();
  const { data: userek, isLoading } = useFelhasznalok();
  const { data: alkalmazasok } = useAlkalmazasok();
  const frissit = useFelhasznaloFrissites();
  // A globális Admin jog minden alkalmazásra kiterjed → megerősítés kell (magunknál külön figyelmeztetés).
  const [adminValtas, setAdminValtas] = useState<{ u: FelhasznaloListaTetel; uj: boolean } | null>(null);

  if (!felhasznalo?.globalisAdmin)
    return (
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Felhasználók</h2>
        <div className="reszlet-altipus">Ehhez globális Admin jogosultság kell.</div>
      </div>
    );
  if (isLoading) return <Betolto />;
  const apps = alkalmazasok ?? [];

  const szerepValt = (u: FelhasznaloListaTetel, alkKod: string, szerep: string) => {
    const tagsagok = (u.tagsagok ?? []).filter((t) => t.alkalmazasKod !== alkKod);
    if (szerep) tagsagok.push({ alkalmazasKod: alkKod, szerepkor: szerep as never });
    frissit.mutate(
      { id: u.id, tagsagok },
      { onSuccess: () => uzenet.siker(`${u.nev} — ${alkKod}: ${szerep || 'nincs tagság'}.`) },
    );
  };
  const adminMent = () => {
    if (!adminValtas) return;
    const { u, uj } = adminValtas;
    frissit.mutate(
      { id: u.id, globalisAdmin: uj },
      {
        onSuccess: () => {
          uzenet.siker(uj ? `${u.nev} globális Admin lett.` : `${u.nev} globális Admin joga megszűnt.`);
          setAdminValtas(null);
        },
      },
    );
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
                    checked={u.globalisAdmin ?? false}
                    disabled={frissit.isPending}
                    onChange={(e) => setAdminValtas({ u, uj: e.target.checked })}
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

      {adminValtas && (
        <Megerosites
          cim={adminValtas.uj ? 'Globális Admin jog adása' : 'Globális Admin jog elvétele'}
          gombFelirat={adminValtas.uj ? 'Jog megadása' : 'Jog elvétele'}
          veszelyes
          folyamatban={frissit.isPending}
          onMegse={() => setAdminValtas(null)}
          onMegerosit={adminMent}
        >
          <p>
            {adminValtas.uj
              ? `${adminValtas.u.nev} minden alkalmazásban teljes jogot kap: szerepköröket oszthat, archiválhat, törölhet, és látja az audit-naplót.`
              : `${adminValtas.u.nev} elveszíti a rendszerszintű jogait; ezután csak az alkalmazás-szerepkörei érvényesek.`}
          </p>
          {!adminValtas.uj && adminValtas.u.id === felhasznalo.id && (
            <p>
              <b>Ez a saját jogod.</b> Elvétele után ezt az oldalt sem éred el — csak egy másik globális Admin adhatja vissza.
            </p>
          )}
        </Megerosites>
      )}
    </>
  );
}
