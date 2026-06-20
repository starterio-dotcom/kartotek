import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUSZOK, type Statusz } from '@kartotek/shared';
import {
  useAlkalmazasok,
  useSzolgaltatasok,
  useElemek,
  useSzolgaltatasLetrehozas,
  useAlkalmazasLetrehozas,
  useAlkalmazasFrissites,
} from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { Betolto, Modal, Hiba } from '../komponens/ui';
import type { Alkalmazas, Elem } from '../api/tipusok';

function foStatusz(e: Elem): Statusz {
  const v = e.verziok.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), e.verziok[0]!);
  return v?.statusz ?? 'Vázlat';
}

export function Attekintes() {
  const nav = useNavigate();
  const { felhasznalo } = useAuth();
  const { data: szolgaltatasok, isLoading: sBetolt } = useSzolgaltatasok();
  const { data: alkalmazasok } = useAlkalmazasok();
  const { data: elemek } = useElemek({});
  const [modal, setModal] = useState<'ujSzolg' | 'ujAlk' | null>(null);
  const [szerkAlk, setSzerkAlk] = useState<Alkalmazas | null>(null);

  if (sBetolt) return <main><Betolto /></main>;
  const szolg = szolgaltatasok?.[0];
  const admin = !!felhasznalo?.globalisAdmin;

  const statPerApp = (kod: string) => {
    const sajat = (elemek ?? []).filter((e) => e.alkalmazasKod === kod);
    const szamlalo = new Map<Statusz, number>();
    for (const e of sajat) szamlalo.set(foStatusz(e), (szamlalo.get(foStatusz(e)) ?? 0) + 1);
    return { ossz: sajat.length, szamlalo };
  };

  return (
    <main>
      <div className="attekintes">
        <div className="szolg-fej">
          <span className="szolg-cimke">Üzleti szolgáltatás</span>
          <h2>{szolg?.nev ?? 'FAIR'}</h2>
          <p>{szolg?.leiras}</p>
          {admin && (
            <div className="szolg-fej-gombok">
              <button className="gomb masodlagos kicsi" onClick={() => setModal('ujSzolg')}>
                + Új szolgáltatás
              </button>
            </div>
          )}
        </div>

        <div className="szolg-alcim-sor">
          <span className="szolg-alcim">Alkalmazások</span>
          {admin && (
            <button className="gomb masodlagos kicsi" onClick={() => setModal('ujAlk')}>
              + Új alkalmazás
            </button>
          )}
        </div>

        <div className="app-racs">
          {(alkalmazasok ?? []).map((a) => {
            const { ossz, szamlalo } = statPerApp(a.kod);
            return (
              <div className="app-kartya" key={a.kod}>
                <div className="app-fej">
                  <div>
                    <div className="app-nev">{a.nev}</div>
                    <span className="lista-kulcs">{a.kod}</span>
                  </div>
                  <div className="app-fej-gombok">
                    {admin && (
                      <button className="ikon-gomb" onClick={() => setSzerkAlk(a)}>
                        Szerkesztés
                      </button>
                    )}
                  </div>
                </div>
                <div className="app-leiras">{a.leiras}</div>
                <div className="app-meta">
                  <div>
                    <b>Elemek</b>
                    {ossz}
                  </div>
                  <div>
                    <b>Kód</b>
                    {a.kod}
                  </div>
                </div>
                <div className="stat-sor">
                  {STATUSZOK.filter((s) => szamlalo.get(s)).map((s) => (
                    <span key={s} className={`badge mini b-${s}`}>
                      {s} {szamlalo.get(s)}
                    </span>
                  ))}
                </div>
                <div className="szolg-fej-gombok">
                  <button className="att-gomb" onClick={() => nav(`/?alk=${a.kod}`)}>
                    <span>Elemek megnyitása</span>
                    <span className="nyil">→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal === 'ujSzolg' && <UjSzolgaltatasModal onBezar={() => setModal(null)} />}
      {modal === 'ujAlk' && (
        <UjAlkalmazasModal szolgaltatasKod={szolg?.kod ?? 'FAIR'} onBezar={() => setModal(null)} />
      )}
      {szerkAlk && <SzerkesztAlkalmazasModal alk={szerkAlk} onBezar={() => setSzerkAlk(null)} />}
    </main>
  );
}

function UjSzolgaltatasModal({ onBezar }: { onBezar: () => void }) {
  const m = useSzolgaltatasLetrehozas();
  const [kod, setKod] = useState('');
  const [nev, setNev] = useState('');
  const [leiras, setLeiras] = useState('');
  return (
    <Modal cim="Új szolgáltatás" onBezar={onBezar}>
      <label>Kód</label>
      <input value={kod} onChange={(e) => setKod(e.target.value)} />
      <label>Név</label>
      <input value={nev} onChange={(e) => setNev(e.target.value)} />
      <label>Leírás</label>
      <textarea value={leiras} onChange={(e) => setLeiras(e.target.value)} />
      {m.isError && <Hiba uzenet={(m.error as Error).message} />}
      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onBezar}>Mégse</button>
        <button
          className="btn"
          disabled={!kod || !nev || m.isPending}
          onClick={() => m.mutate({ kod, nev, leiras }, { onSuccess: onBezar })}
        >
          Létrehozás
        </button>
      </div>
    </Modal>
  );
}

function UjAlkalmazasModal({ szolgaltatasKod, onBezar }: { szolgaltatasKod: string; onBezar: () => void }) {
  const m = useAlkalmazasLetrehozas();
  const [kod, setKod] = useState('');
  const [nev, setNev] = useState('');
  const [leiras, setLeiras] = useState('');
  return (
    <Modal cim="Új alkalmazás" onBezar={onBezar}>
      <label>Kód (az elem-kulcsok prefixe)</label>
      <input value={kod} onChange={(e) => setKod(e.target.value)} />
      <label>Név</label>
      <input value={nev} onChange={(e) => setNev(e.target.value)} />
      <label>Leírás</label>
      <textarea value={leiras} onChange={(e) => setLeiras(e.target.value)} />
      {m.isError && <Hiba uzenet={(m.error as Error).message} />}
      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onBezar}>Mégse</button>
        <button
          className="btn"
          disabled={!kod || !nev || m.isPending}
          onClick={() => m.mutate({ kod, nev, leiras, szolgaltatasKod }, { onSuccess: onBezar })}
        >
          Létrehozás
        </button>
      </div>
    </Modal>
  );
}

function SzerkesztAlkalmazasModal({ alk, onBezar }: { alk: Alkalmazas; onBezar: () => void }) {
  const m = useAlkalmazasFrissites();
  const [nev, setNev] = useState(alk.nev);
  const [leiras, setLeiras] = useState(alk.leiras ?? '');
  return (
    <Modal cim={`Alkalmazás szerkesztése — ${alk.kod}`} onBezar={onBezar}>
      <label>Név</label>
      <input value={nev} onChange={(e) => setNev(e.target.value)} />
      <label>Leírás</label>
      <textarea value={leiras} onChange={(e) => setLeiras(e.target.value)} />
      {m.isError && <Hiba uzenet={(m.error as Error).message} />}
      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onBezar}>Mégse</button>
        <button
          className="btn"
          disabled={m.isPending}
          onClick={() => m.mutate({ kod: alk.kod, nev, leiras }, { onSuccess: onBezar })}
        >
          Mentés
        </button>
      </div>
    </Modal>
  );
}
