import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, DEV_FELHASZNALOK } from '../allapot/auth';
import { useSzolgaltatasok } from '../api/hooks';
import { api } from '../api/kliens';
import { ListaPanel } from '../nezet/ListaPanel';
import { Graf } from '../nezet/Graf';
import { UjElemModal } from '../nezet/UjElemModal';

function maStr() {
  return new Date().toISOString().slice(0, 10);
}

export function Elrendezes() {
  const { felhasznalo, emailBeallit, oidc, login, logout } = useAuth();
  const { data: szolgaltatasok } = useSzolgaltatasok();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [ujNyitva, setUjNyitva] = useState(false);

  const alk = params.get('alk') ?? '';
  const grafNezet = location.pathname === '/graf';

  const utemezo = useMutation({
    mutationFn: () => api.post('/api/utemezo/futtat', { ma: maStr() }),
    onSuccess: () => void qc.invalidateQueries(),
  });

  const setQ = (q: string) => {
    const uj = new URLSearchParams(params);
    if (q) uj.set('q', q);
    else uj.delete('q');
    setParams(uj, { replace: true });
  };

  const letrehozhat =
    felhasznalo &&
    (felhasznalo.globalisAdmin ||
      felhasznalo.tagsagok.some((t) => ['Szerző', 'Admin'].includes(t.szerepkor)));

  return (
    <>
      <a className="skip-link" href="#fo-tartalom">
        Ugrás a tartalomra
      </a>
      <header>
        <div className="brand">
          <div className="brand-jel" aria-hidden="true" />
          <div>
            <h1>Kartoték</h1>
            <div className="al">{szolgaltatasok?.[0]?.nev ?? 'FAIR'} · követelménykövetés</div>
          </div>
        </div>

        <div className="kereso-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="kereso"
            type="search"
            placeholder="Keresés kulcsra, címre, címkére"
            value={params.get('q') ?? ''}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Keresés"
          />
        </div>

        <div className="header-spacer" />

        {felhasznalo?.globalisAdmin && (
          <button
            className="gomb masodlagos"
            onClick={() => utemezo.mutate()}
            disabled={utemezo.isPending}
            title="Dátumvezérelt AUTO átmenetek végrehajtása"
          >
            ▶ Ütemező
          </button>
        )}
        <button
          className={`gomb masodlagos${grafNezet ? ' aktiv' : ''}`}
          aria-current={grafNezet ? 'page' : undefined}
          onClick={() => nav(`/graf?${alk ? `alk=${alk}` : ''}`)}
        >
          ◍ Gráf
        </button>
        <button
          className={`gomb masodlagos${location.pathname === '/riportok' ? ' aktiv' : ''}`}
          aria-current={location.pathname === '/riportok' ? 'page' : undefined}
          onClick={() => nav(`/riportok?${alk ? `alk=${alk}` : ''}`)}
        >
          ▤ Riportok
        </button>
        <button
          className={`gomb masodlagos${location.pathname === '/kiadasok' ? ' aktiv' : ''}`}
          aria-current={location.pathname === '/kiadasok' ? 'page' : undefined}
          onClick={() => nav('/kiadasok')}
        >
          ⎙ Kiadások
        </button>

        <div className="hctrl">
          {oidc ? (
            felhasznalo ? (
              <>
                <span className="felh-nev" title={felhasznalo.email}>{felhasznalo.nev}</span>
                <button className="gomb masodlagos" onClick={logout}>Kilépés</button>
              </>
            ) : (
              <button className="gomb elsodleges" onClick={login}>Bejelentkezés</button>
            )
          ) : (
            <select
              aria-label="Felhasználó (dev)"
              value={felhasznalo?.email ?? ''}
              onChange={(e) => emailBeallit(e.target.value || null)}
            >
              <option value="">— belépés —</option>
              {DEV_FELHASZNALOK.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.nev}
                </option>
              ))}
            </select>
          )}
        </div>

        {letrehozhat && (
          <button className="gomb elsodleges" onClick={() => setUjNyitva(true)}>
            + Új elem
          </button>
        )}
      </header>

      {!felhasznalo ? (
        <main id="fo-tartalom">
          <div className="ures-allapot">
            <h2>Üdvözlünk a Kartotékrendszerben</h2>
            {oidc ? (
              <p>
                Jelentkezz be a folytatáshoz.{' '}
                <button className="gomb elsodleges" onClick={login}>Bejelentkezés</button>
              </p>
            ) : (
              <p>Válassz felhasználót a jobb felső sarokban a belépéshez.</p>
            )}
          </div>
        </main>
      ) : grafNezet ? (
        <main id="fo-tartalom">
          <Graf />
        </main>
      ) : (
        <div className="layout">
          <aside aria-label="Elemlista">
            <ListaPanel />
          </aside>
          <main id="fo-tartalom">
            <Outlet />
          </main>
        </div>
      )}

      {ujNyitva && <UjElemModal alapAlkalmazas={alk} onBezar={() => setUjNyitva(false)} />}
    </>
  );
}
