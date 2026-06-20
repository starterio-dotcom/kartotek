import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLefedettseg, useMegfeleles } from '../api/hooks';
import { Betolto, Hiba } from '../komponens/ui';
import type { ElemFej } from '../api/tipusok';

type Ful = 'lefedettseg' | 'megfeleles';

function ElemHivatkozas({ e }: { e: ElemFej }) {
  return (
    <Link className="kapcs-link" to={`/elem/${e.id}`}>
      <span className="riport-kulcs">{e.kulcs}</span> {e.cim}
    </Link>
  );
}

function Lefedettseg({ alk }: { alk: string }) {
  const { data, isLoading, isError, error } = useLefedettseg(alk);
  if (isLoading) return <Betolto />;
  if (isError) return <Hiba uzenet={(error as Error).message} />;
  if (!data) return null;
  const fedett = data.osszesBus - data.fedetlenek.length;
  return (
    <div className="blokk">
      <div className="blokk-cim">Lefedettség — üzleti story → technikai story</div>
      <p className="torzs riport-osszegzo">
        {data.osszesBus} üzleti story (BUS) közül <b>{fedett}</b> fedett, <b>{data.fedetlenek.length}</b> még TUS
        nélkül van. A lefedettség a <code>lebontja</code>-fa bejárásából származik.
      </p>
      {data.fedetlenek.length === 0 ? (
        <div className="torzs"><span className="ures">Minden BUS-hoz tartozik (közvetve) TUS. ✓</span></div>
      ) : (
        <ul className="riport-lista">
          {data.fedetlenek.map((e) => (
            <li key={e.id} className="riport-sor">
              <span className="badge mini b-Elvetve" title="Nincs lebontó TUS">fedetlen</span>
              <ElemHivatkozas e={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Megfeleles({ alk }: { alk: string }) {
  const { data, isLoading, isError, error } = useMegfeleles(alk);
  if (isLoading) return <Betolto />;
  if (isError) return <Hiba uzenet={(error as Error).message} />;
  if (!data) return null;
  return (
    <div className="blokk">
      <div className="blokk-cim">Megfelelés — szabályzatonkénti lefedettség</div>
      <p className="torzs riport-osszegzo">
        A <code>megfelel → Szabályzat</code> kapcsolatokból. Szabályzatonként a megfelelő elemek.
      </p>
      {data.length === 0 ? (
        <div className="torzs"><span className="ures">Nincs szabályzat.</span></div>
      ) : (
        data.map((t) => (
          <div className="riport-megf" key={t.kod}>
            <div className="riport-megf-fej">
              {t.url ? (
                <a href={t.url} target="_blank" rel="noreferrer" className="kapcs-link">
                  {t.kod}
                </a>
              ) : (
                <span className="riport-kulcs">{t.kod}</span>
              )}
              <span className="riport-megf-nev">{t.nev}</span>
              <span className={`badge mini ${t.megfelelok.length ? 'b-Hatályos' : 'b-Elvetve'}`}>
                {t.megfelelok.length} megfelelő
              </span>
            </div>
            {t.megfelelok.length > 0 && (
              <ul className="riport-lista">
                {t.megfelelok.map((e) => (
                  <li key={e.id} className="riport-sor">
                    <ElemHivatkozas e={e} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export function Riportok() {
  const [params] = useSearchParams();
  const alk = params.get('alk') ?? '';
  const [ful, setFul] = useState<Ful>('lefedettseg');

  return (
    <>
      <div className="reszlet-fej">
        <h2 className="reszlet-cim">Riportok{alk ? ` · ${alk}` : ' · minden alkalmazás'}</h2>
        <div className="reszlet-altipus">Traceability-riportok a kapcsolati gráfból</div>
      </div>
      <div className="riport-tabok">
        <button
          className={`verzio-tab${ful === 'lefedettseg' ? ' aktiv' : ''}`}
          onClick={() => setFul('lefedettseg')}
        >
          Lefedettség
        </button>
        <button
          className={`verzio-tab${ful === 'megfeleles' ? ' aktiv' : ''}`}
          onClick={() => setFul('megfeleles')}
        >
          Megfelelés
        </button>
      </div>
      {ful === 'lefedettseg' ? <Lefedettseg alk={alk} /> : <Megfeleles alk={alk} />}
    </>
  );
}
