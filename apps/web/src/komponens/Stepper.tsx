import { Fragment } from 'react';
import type { Statusz } from '@kartotek/shared';

const FOLYAM: Statusz[] = ['Vázlat', 'Véleményezés', 'Jóváhagyott', 'Hatályos', 'Elavult', 'Archivált'];
const ST_SZIN: Record<string, [string, string]> = {
  Vázlat: ['#5C6677', '#EEF1F5'],
  Véleményezés: ['#A65200', '#FFF3E3'],
  Jóváhagyott: ['#065E90', '#E9F4FC'],
  Hatályos: ['#066E2B', '#E7F8EE'],
  Elavult: ['#5A6372', '#E3E6EC'],
  Archivált: ['#373D49', '#E3E6EC'],
};

const Pipa = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Az életciklus-stepper (a prototípus szignatúra eleme). */
export function Stepper({ statusz }: { statusz: Statusz }) {
  if (statusz === 'Elvetve') {
    return (
      <div className="stepper-elvetve">
        <span className="badge nagy b-Elvetve">Elvetve</span>
        <span style={{ color: 'var(--t-halk)', fontWeight: 500 }}>
          Végállapot — az auditnyom megmaradt, az elem nem szerkeszthető.
        </span>
      </div>
    );
  }
  const akt = FOLYAM.indexOf(statusz);
  return (
    <div className="stepper">
      {FOLYAM.map((st, i) => {
        const allapot = i < akt ? 'kesz' : i === akt ? 'aktualis' : '';
        const [szin, tint] = ST_SZIN[st]!;
        const auto = st === 'Hatályos' || st === 'Elavult';
        return (
          <Fragment key={st}>
            {i > 0 && (
              <div className={`osszekoto${i <= akt ? ' kesz' : ''}`}>
                {auto && <span className="auto-cimke">AUTO</span>}
              </div>
            )}
            <div
              className={`lepes ${allapot}`}
              style={allapot === 'aktualis' ? ({ ['--st-szin' as string]: szin, ['--st-tint' as string]: tint } as React.CSSProperties) : undefined}
            >
              <span className="pont">{allapot === 'kesz' ? <Pipa /> : ''}</span>
              <span className="felirat">{st}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
