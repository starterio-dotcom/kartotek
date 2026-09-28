import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, DEV_FELHASZNALOK } from '../allapot/auth';
import { useMunkam, useSzolgaltatasok } from '../api/hooks';
import { api } from '../api/kliens';
import { uzenet } from '../allapot/uzenetek';
import { ListaPanel } from '../nezet/ListaPanel';
import { Graf } from '../nezet/Graf';
import { UjElemModal } from '../nezet/UjElemModal';
import { ErtesitesHarang } from './ErtesitesHarang';
import { Legordulo } from './Legordulo';

/** Build-időben rögzített környezet: a staging jól láthatóan elkülönül az éles rendszertől. */
const TESZTKORNYEZET = import.meta.env.VITE_KORNYEZET === 'staging';
if (TESZTKORNYEZET && typeof document !== 'undefined' && !document.title.startsWith('[TESZT]'))
  document.title = `[TESZT] ${document.title}`;

/** A mai nap HELYI idő szerint (a `toISOString` UTC-je éjfél és 02:00 között a tegnapot adná). */
function maStr() {
  return new Date().toLocaleDateString('sv-SE');
}

interface UtemezoEredmeny {
  valtozas: number;
  hatalybalepes: number;
  elavulas: number;
  hibas: number;
}

function utemezoSzoveg(e: UtemezoEredmeny): string {
  if (!e.valtozas && !e.hibas) return 'Ütemező lefutott — nem volt esedékes átmenet.';
  const reszek = [
    e.hatalybalepes ? `${e.hatalybalepes} hatályba lépett` : '',
    e.elavulas ? `${e.elavulas} elavult` : '',
    e.hibas ? `${e.hibas} léptetése sikertelen (a következő futás pótolja)` : '',
  ].filter(Boolean);
  return `Ütemező lefutott: ${reszek.join(', ')}.`;
}

export function Elrendezes() {
  const { felhasznalo, betolt, emailBeallit, oidc, login, logout } = useAuth();
  // Kijelentkezve nem kérdezünk le — token nélkül csak 401 lenne belőle.
  const { data: szolgaltatasok } = useSzolgaltatasok({ enabled: !!felhasznalo });
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const qc = useQueryClient();
  const [ujNyitva, setUjNyitva] = useState(false);

  const alk = params.get('alk') ?? '';
  const grafNezet = location.pathname === '/graf';
  const admin = !!felhasznalo?.globalisAdmin;
  const { data: munkam } = useMunkam(!!felhasznalo);
  // A jelvény a CSELEKVÉST igénylő tételeket számolja: rám váró döntés + visszadobott verzió.
  const teendok = (munkam?.ramVar.length ?? 0) + (munkam?.visszadobva.length ?? 0);
  const alkQs = alk ? `?alk=${alk}` : '';
  const utvonal = location.pathname;
  const navPontok = [
    { ut: '/munkam', ikon: '★', cimke: 'Munkám', aktiv: utvonal === '/munkam', jelveny: teendok },
    { ut: `/graf${alkQs}`, ikon: '◍', cimke: 'Gráf', aktiv: grafNezet, jelveny: 0 },
    { ut: `/dosszie${alkQs}`, ikon: '▦', cimke: 'Dosszié', aktiv: utvonal === '/dosszie', jelveny: 0 },
    { ut: `/riportok${alkQs}`, ikon: '▤', cimke: 'Riportok', aktiv: utvonal === '/riportok', jelveny: 0 },
    { ut: '/kiadasok', ikon: '⎙', cimke: 'Kiadások', aktiv: utvonal === '/kiadasok', jelveny: 0 },
  ];

  const utemezo = useMutation({
    mutationFn: () => api.post<UtemezoEredmeny>('/api/utemezo/futtat', { ma: maStr() }),
    onSuccess: (e) => {
      void qc.invalidateQueries();
      uzenet.siker(utemezoSzoveg(e));
    },
  });

  const setQ = (q: string) => {
    const uj = new URLSearchParams(params);
    if (q) uj.set('q', q);
    else uj.delete('q');
    setParams(uj, { replace: true });
  };

  // Render-függvény (nem beágyazott komponens): a szülő újrarenderelése ne csatolja újra.
  const adminPontok = (bezar: () => void) => (
      <>
        {[
          { ut: '/felhasznalok', ikon: '☖', cimke: 'Felhasználók' },
          { ut: '/audit', ikon: '☷', cimke: 'Audit-napló' },
        ].map((p) => (
          <Link
            key={p.ut}
            to={p.ut}
            className="legordulo-tetel"
            aria-current={utvonal === p.ut ? 'page' : undefined}
            onClick={bezar}
          >
            <span aria-hidden="true">{p.ikon}</span> {p.cimke}
          </Link>
        ))}
        <button
          type="button"
          className="legordulo-tetel"
          disabled={utemezo.isPending}
          title="Dátumvezérelt AUTO átmenetek végrehajtása most"
          onClick={() => {
            bezar();
            utemezo.mutate();
          }}
        >
          <span aria-hidden="true">▶</span> Ütemező futtatása
        </button>
      </>
  );

  const letrehozhat =
    felhasznalo &&
    (felhasznalo.globalisAdmin ||
      felhasznalo.tagsagok.some((t) => ['Szerző', 'Admin'].includes(t.szerepkor)));

  return (
    <>
      <a className="skip-link" href="#fo-tartalom">
        Ugrás a tartalomra
      </a>
      {TESZTKORNYEZET && (
        <div className="kornyezet-sav" role="note">
          TESZTKÖRNYEZET — az adatok nem élesek
        </div>
      )}
      <header>
        <Link to="/" className="brand" aria-label="Kartoték — áttekintés">
          <div className="brand-jel" aria-hidden="true" />
          <div>
            <h1>Kartoték</h1>
            <div className="al">{szolgaltatasok?.[0]?.nev ?? 'FAIR'} · követelménykövetés</div>
          </div>
        </Link>

        <div className="kereso-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="kereso"
            type="search"
            placeholder="Keresés kulcsra, címre, címkére, tartalomra"
            value={params.get('q') ?? ''}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Keresés"
          />
        </div>

        <div className="header-spacer" />

        {felhasznalo && (
          <nav aria-label="Fő navigáció" className="fo-nav">
            {navPontok.map((p) => (
              <Link
                key={p.ut}
                to={p.ut}
                className={`gomb masodlagos${p.aktiv ? ' aktiv' : ''}`}
                aria-current={p.aktiv ? 'page' : undefined}
              >
                <span aria-hidden="true">{p.ikon}</span> {p.cimke}
                {p.jelveny ? (
                  <span className="nav-jelveny">
                    <span className="sr-only">, teendő: </span>
                    {p.jelveny}
                  </span>
                ) : null}
              </Link>
            ))}
            {admin && <Legordulo cimke="Admin">{adminPontok}</Legordulo>}
          </nav>
        )}
        {felhasznalo && (
          // Szűk képernyőn (≤1180 px) a teljes navigáció egyetlen menübe csukódik.
          <Legordulo
            className="menu-szuk"
            cimke={
              <>
                ☰ Menü
                {teendok ? <span className="nav-jelveny">{teendok}</span> : null}
              </>
            }
          >
            {(bezar) => (
              <>
                {navPontok.map((p) => (
                  <Link
                    key={p.ut}
                    to={p.ut}
                    className="legordulo-tetel"
                    aria-current={p.aktiv ? 'page' : undefined}
                    onClick={bezar}
                  >
                    <span aria-hidden="true">{p.ikon}</span> {p.cimke}
                    {p.jelveny ? <span className="nav-jelveny">{p.jelveny}</span> : null}
                  </Link>
                ))}
                {admin && <div className="legordulo-elvalaszto" role="separator" />}
                {admin && adminPontok(bezar)}
              </>
            )}
          </Legordulo>
        )}

        <div className="hctrl">
          {oidc ? (
            felhasznalo ? (
              <>
                <ErtesitesHarang />
                <span className="felh-nev" title={felhasznalo.email}>{felhasznalo.nev}</span>
                <button className="gomb masodlagos" onClick={logout}>Kilépés</button>
              </>
            ) : betolt ? null : (
              <button className="gomb elsodleges" onClick={login}>Bejelentkezés</button>
            )
          ) : (
            <>
            {felhasznalo && <ErtesitesHarang />}
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
            </>
          )}
        </div>

        {letrehozhat && (
          <button className="gomb elsodleges uj-elem-gomb" onClick={() => setUjNyitva(true)} aria-label="Új elem">
            <span aria-hidden="true">+</span>
            <span className="uj-elem-szoveg" aria-hidden="true"> Új elem</span>
          </button>
        )}
      </header>

      {!felhasznalo && betolt ? (
        // Auth-állapot feloldása folyamatban — ne a login-modul villanjon.
        <main id="fo-tartalom" aria-busy="true">
          <div className="ures-allapot">
            <p>Betöltés…</p>
          </div>
        </main>
      ) : !felhasznalo ? (
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
        <div className={`layout${utvonal === '/' ? '' : ' layout-reszlet'}`}>
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
