import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useKiadasok, useKiadasTartalom, useKiadasLetrehozas } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { Betolto, Hiba, Modal } from '../komponens/ui';

const datumHu = (d: string) => new Date(d).toLocaleDateString('hu-HU');

function KiadasTartalom({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useKiadasTartalom(id);
  if (isLoading) return <Betolto />;
  if (isError) return <Hiba uzenet={(error as Error).message} />;
  if (!data) return null;
  return (
    <div className="blokk">
      <div className="blokk-cim">
        {data.kiadas.verzio} · {datumHu(data.kiadas.datum)} — {data.verziok.length} verzió
      </div>
      {data.verziok.length === 0 ? (
        <div className="torzs"><span className="ures">Ehhez a kiadáshoz még nincs verzió rendelve.</span></div>
      ) : (
        <ul className="riport-lista">
          {data.verziok.map((v) => (
            <li key={`${v.elemId}-${v.verzioSzam}`} className="riport-sor">
              <span className={`badge mini b-${v.statusz}`}>{v.statusz}</span>
              <Link className="kapcs-link" to={`/elem/${v.elemId}`}>
                <span className="riport-kulcs">{v.kulcs}</span> v{v.verzioSzam} · {v.cim}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UjKiadasModal({ onBezar }: { onBezar: () => void }) {
  const letrehoz = useKiadasLetrehozas();
  const [verzio, setVerzio] = useState('');
  const [datum, setDatum] = useState('');
  const kuld = () =>
    letrehoz.mutate({ verzio: verzio.trim(), datum }, { onSuccess: onBezar });
  return (
    <Modal cim="Új kiadás" onBezar={onBezar}>
      <label>Megnevezés</label>
      <input value={verzio} onChange={(e) => setVerzio(e.target.value)} placeholder="pl. R6 · 2026 Q3" />
      <label>Dátum</label>
      <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
      {letrehoz.isError && <Hiba uzenet={(letrehoz.error as Error).message} />}
      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onBezar}>Mégse</button>
        <button className="btn" disabled={!verzio.trim() || !datum || letrehoz.isPending} onClick={kuld}>
          Létrehozás
        </button>
      </div>
    </Modal>
  );
}

export function Kiadasok() {
  const { felhasznalo } = useAuth();
  const { data: kiadasok, isLoading } = useKiadasok();
  const [valasztott, setValasztott] = useState<string | null>(null);
  const [ujNyitva, setUjNyitva] = useState(false);

  if (isLoading) return <Betolto />;
  const lista = kiadasok ?? [];
  const aktiv = valasztott ?? lista[0]?.id ?? null;

  return (
    <>
      <div className="reszlet-fej">
        <div className="rf-felso">
          <div className="rf-cimblokk">
            <h2 className="reszlet-cim">Kiadások</h2>
            <div className="reszlet-altipus">Verziók kiadásokhoz (release) rendelése és kiadás szerinti nézet</div>
          </div>
          {felhasznalo?.globalisAdmin && (
            <div className="rf-akciok">
              <button className="gomb elsodleges" onClick={() => setUjNyitva(true)}>+ Új kiadás</button>
            </div>
          )}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="torzs"><span className="ures">Még nincs kiadás.</span></div>
      ) : (
        <>
          <div className="riport-tabok">
            {lista.map((k) => (
              <button
                key={k.id}
                className={`verzio-tab${k.id === aktiv ? ' aktiv' : ''}`}
                onClick={() => setValasztott(k.id)}
              >
                <span className="vszam">{k.verzio}</span>
                <span className="tolto" />
                <span style={{ color: 'var(--t-leges)', fontSize: 11 }}>{datumHu(k.datum)}</span>
              </button>
            ))}
          </div>
          {aktiv && <KiadasTartalom id={aktiv} />}
        </>
      )}

      {ujNyitva && <UjKiadasModal onBezar={() => setUjNyitva(false)} />}
    </>
  );
}
