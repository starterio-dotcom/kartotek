import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAudit, type AuditSzuro } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { Betolto, Hiba } from '../komponens/ui';
import { ESEMENY_FELIRAT, eredmenyCimke, muveletCimke } from '../domain/audit';
import type { ApiHiba } from '../api/kliens';

const OLDAL = 50;

/** Helyi (böngésző-idő szerinti) napkezdet/-vég ISO-ban a szerveroldali szűréshez. */
function napHatar(nap: string, vege: boolean): string {
  return new Date(`${nap}T${vege ? '23:59:59.999' : '00:00:00'}`).toISOString();
}

/** Admin-felület: ki, mit, mikor, honnan — módosítások, elutasított hozzáférések, érzékeny olvasások. */
export function AuditNaplo() {
  const { felhasznalo } = useAuth();
  const [urlap, setUrlap] = useState({ esemeny: '', felhasznalo: '', tol: '', ig: '' });
  const [szuro, setSzuro] = useState<AuditSzuro>({ limit: OLDAL, offset: 0 });
  const admin = !!felhasznalo?.globalisAdmin;
  const { data, isLoading, isError, error, isFetching } = useAudit(szuro, admin);

  if (!admin)
    return (
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Audit-napló</h2>
        <div className="reszlet-altipus">Ehhez globális Admin jogosultság kell.</div>
      </div>
    );

  const szur = (e: FormEvent) => {
    e.preventDefault();
    setSzuro({
      limit: OLDAL,
      offset: 0,
      ...(urlap.esemeny ? { esemeny: urlap.esemeny } : {}),
      ...(urlap.felhasznalo.trim() ? { felhasznalo: urlap.felhasznalo.trim() } : {}),
      ...(urlap.tol ? { tol: napHatar(urlap.tol, false) } : {}),
      ...(urlap.ig ? { ig: napHatar(urlap.ig, true) } : {}),
    });
  };
  const lapoz = (irany: 1 | -1) =>
    setSzuro((s) => ({ ...s, offset: Math.max(0, s.offset + irany * OLDAL) }));

  const osszes = data?.osszes ?? 0;
  const tol = osszes ? szuro.offset + 1 : 0;
  const ig = Math.min(szuro.offset + OLDAL, osszes);

  return (
    <>
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Audit-napló</h2>
        <div className="reszlet-altipus">
          Minden módosítás, elutasított hozzáférés és érzékeny olvasás — ki, mit, mikor, honnan.
          A napló csak bővülhet; a lekérdezése is naplózódik.
        </div>
      </div>

      <form className="blokk audit-szuro" onSubmit={szur}>
        <label>
          Esemény
          <select
            value={urlap.esemeny}
            onChange={(e) => setUrlap({ ...urlap, esemeny: e.target.value })}
          >
            <option value="">Mind</option>
            {Object.entries(ESEMENY_FELIRAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Felhasználó
          <input
            className="mezo-be"
            placeholder="e-mail vagy név"
            value={urlap.felhasznalo}
            onChange={(e) => setUrlap({ ...urlap, felhasznalo: e.target.value })}
          />
        </label>
        <label>
          Ettől
          <input type="date" value={urlap.tol} onChange={(e) => setUrlap({ ...urlap, tol: e.target.value })} />
        </label>
        <label>
          Eddig
          <input type="date" value={urlap.ig} onChange={(e) => setUrlap({ ...urlap, ig: e.target.value })} />
        </label>
        <button className="gomb elsodleges" type="submit">
          Szűrés
        </button>
      </form>

      {isError && <Hiba uzenet={(error as ApiHiba).message} />}
      {isLoading ? (
        <Betolto />
      ) : (
        <div className="blokk">
          <div className="audit-lapozo" aria-live="polite">
            <span>
              {osszes ? `${tol}–${ig} / ${osszes} bejegyzés` : 'Nincs a szűrésnek megfelelő bejegyzés.'}
              {isFetching ? ' · frissítés…' : ''}
            </span>
            <span className="tolto" />
            <button className="gomb masodlagos" disabled={szuro.offset === 0} onClick={() => lapoz(-1)}>
              ← Előző
            </button>
            <button className="gomb masodlagos" disabled={ig >= osszes} onClick={() => lapoz(1)}>
              Következő →
            </button>
          </div>
          <table className="felh-tabla audit-tabla">
            <thead>
              <tr>
                <th>Időpont</th>
                <th>Felhasználó</th>
                <th>Esemény</th>
                <th>Művelet</th>
                <th>Érintett elem</th>
                <th>Eredmény</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {(data?.bejegyzesek ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="audit-ido">{new Date(b.idopont).toLocaleString('hu-HU')}</td>
                  <td>
                    {b.nev ? (
                      <>
                        <b>{b.nev}</b>
                        <div className="felh-email">{b.email}</div>
                      </>
                    ) : (
                      <span className="ures">névtelen</span>
                    )}
                  </td>
                  <td>
                    <span className={`audit-esemeny audit-${b.esemeny}`}>{ESEMENY_FELIRAT[b.esemeny]}</span>
                  </td>
                  <td title={`${b.metodus} ${b.ut}`}>{muveletCimke(b.metodus, b.utvonal)}</td>
                  <td>
                    {b.elemId && b.elemKulcs ? (
                      <Link to={`/elem/${b.elemId}`}>{b.elemKulcs}</Link>
                    ) : (
                      (b.elemId ?? '—')
                    )}
                  </td>
                  <td>
                    {eredmenyCimke(b.statusz)} <span className="audit-kod">({b.statusz})</span>
                  </td>
                  <td className="audit-ip">{b.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
