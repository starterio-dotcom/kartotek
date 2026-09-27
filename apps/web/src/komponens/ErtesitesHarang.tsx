import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErtesitesek, useErtesitesOlvasva } from '../api/hooks';
import { ESEMENY_CIMKE, relativIdo } from '../domain/ertesites';
import type { Ertesites } from '../api/tipusok';

/**
 * Felületi értesítések a fejlécben (a spec szerint ez az alapcsatorna; az e-mail
 * opcionális). Olvasatlan-számláló, lenyíló lista; kattintásra az elemre visz és
 * olvasottra állít. Billentyűzettel kezelhető: Esc bezárja, a fókusz visszatér.
 */
export function ErtesitesHarang() {
  const { data } = useErtesitesek(true);
  const olvasva = useErtesitesOlvasva();
  const nav = useNavigate();
  const [nyitva, setNyitva] = useState(false);
  const gomb = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const olvasatlan = data?.olvasatlan ?? 0;

  useEffect(() => {
    if (!nyitva) return;
    const kattint = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !gomb.current?.contains(e.target as Node))
        setNyitva(false);
    };
    const billentyu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNyitva(false);
        gomb.current?.focus();
      }
    };
    document.addEventListener('mousedown', kattint);
    document.addEventListener('keydown', billentyu);
    return () => {
      document.removeEventListener('mousedown', kattint);
      document.removeEventListener('keydown', billentyu);
    };
  }, [nyitva]);

  const megnyit = (e: Ertesites) => {
    if (!e.olvasva) olvasva.mutate([e.id]);
    setNyitva(false);
    nav(`/elem/${e.elemId}`);
  };

  return (
    <div className="ert-wrap">
      <button
        ref={gomb}
        className="gomb masodlagos ert-gomb"
        aria-haspopup="true"
        aria-expanded={nyitva}
        aria-label={olvasatlan ? `Értesítések, ${olvasatlan} olvasatlan` : 'Értesítések'}
        title="Értesítések"
        onClick={() => setNyitva((x) => !x)}
      >
        🔔
        {olvasatlan > 0 && (
          <span className="ert-szamlalo" aria-hidden="true">
            {olvasatlan > 99 ? '99+' : olvasatlan}
          </span>
        )}
      </button>

      {nyitva && (
        <div ref={panel} className="ert-panel" role="region" aria-label="Értesítések">
          <div className="ert-fej">
            <b>Értesítések</b>
            <span className="tolto" />
            {olvasatlan > 0 && (
              <button className="chip" disabled={olvasva.isPending} onClick={() => olvasva.mutate(undefined)}>
                Mind olvasott
              </button>
            )}
          </div>
          {!data?.ertesitesek.length ? (
            <div className="ert-ures">Nincs értesítés.</div>
          ) : (
            <ul className="ert-lista">
              {data.ertesitesek.map((e) => (
                <li key={e.id}>
                  <button className={`ert-tetel${e.olvasva ? '' : ' olvasatlan'}`} onClick={() => megnyit(e)}>
                    <span className={`ert-esemeny ert-${e.esemeny}`}>{ESEMENY_CIMKE[e.esemeny]}</span>
                    <span className="ert-cim">
                      {e.elemKulcs} v{e.verzioSzam} — {e.cim}
                    </span>
                    <span className="ert-uzenet">{e.uzenet}</span>
                    <span className="ert-ido">
                      {relativIdo(e.letrehozva)}
                      {e.olvasva ? '' : ' · olvasatlan'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
