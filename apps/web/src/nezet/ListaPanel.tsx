import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TIPUS_KODOK, type Statusz } from '@kartotek/shared';
import { useElemek, useAlkalmazasok } from '../api/hooks';
import { Betolto, Hiba } from '../komponens/ui';
import type { Elem, Verzio } from '../api/tipusok';

const TABOK: { kulcs: string; nev: string; statuszok: Statusz[] | null }[] = [
  { kulcs: '', nev: 'Mind', statuszok: null },
  { kulcs: 'hatalyos', nev: 'Hatályos', statuszok: ['Hatályos'] },
  { kulcs: 'folyamatban', nev: 'Folyamatban', statuszok: ['Vázlat', 'Véleményezés', 'Jóváhagyott'] },
  { kulcs: 'lezart', nev: 'Lezárt', statuszok: ['Elavult', 'Archivált', 'Elvetve'] },
];

/** A listában kiemelt verzió: a legfrissebb nem-végállapotú, vagy a legmagasabb. */
function elsodlegesVerzio(e: Elem): Verzio {
  const aktiv = e.verziok.filter((v) => !['Elvetve', 'Archivált'].includes(v.statusz));
  const halmaz = aktiv.length ? aktiv : e.verziok;
  return halmaz.reduce((a, b) => (b.verzioSzam > a.verzioSzam ? b : a), halmaz[0]!);
}

export function ListaPanel() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { id: aktivId } = useParams();

  const alk = params.get('alk') ?? '';
  const q = (params.get('q') ?? '').toLowerCase();
  const tab = params.get('tab') ?? '';
  const tipusHalmaz = new Set((params.get('tipus') ?? '').split(',').filter(Boolean));

  const { data, isLoading, isError, error } = useElemek(alk ? { alkalmazasKod: alk } : {});

  const valt = (kulcs: string, ertek: string) => {
    const uj = new URLSearchParams(params);
    if (ertek) uj.set(kulcs, ertek);
    else uj.delete(kulcs);
    setParams(uj);
  };
  const tipusValt = (t: string) => {
    if (tipusHalmaz.has(t)) tipusHalmaz.delete(t);
    else tipusHalmaz.add(t);
    valt('tipus', [...tipusHalmaz].join(','));
  };

  const aktivTab = TABOK.find((t) => t.kulcs === tab) ?? TABOK[0]!;
  const talalatok = (data ?? []).filter((e) => {
    if (tipusHalmaz.size && !tipusHalmaz.has(e.tipusKod)) return false;
    if (aktivTab.statuszok && !e.verziok.some((v) => aktivTab.statuszok!.includes(v.statusz)))
      return false;
    if (
      q &&
      !(
        e.kulcs.toLowerCase().includes(q) ||
        e.verziok.some((v) => v.cim.toLowerCase().includes(q)) ||
        e.cimkek.join(' ').toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  return (
    <>
      <div className="panel-fej">
        <div className="szuro-sor" role="group" aria-label="Alkalmazás szűrő">
          <button className={`chip${!alk ? ' aktiv' : ''}`} onClick={() => valt('alk', '')}>
            Összes
          </button>
          <AlkChipek alk={alk} onValt={(k) => valt('alk', k)} />
        </div>

        <div className="szegmens">
          {TABOK.map((t) => {
            const db = (data ?? []).filter(
              (e) => !t.statuszok || e.verziok.some((v) => t.statuszok!.includes(v.statusz)),
            ).length;
            return (
              <button
                key={t.kulcs}
                className={aktivTab.kulcs === t.kulcs ? 'aktiv' : ''}
                onClick={() => valt('tab', t.kulcs)}
              >
                {t.nev}
                <span className="db">{db}</span>
              </button>
            );
          })}
        </div>

        <div className="szuro-sor" role="group" aria-label="Típus szűrő">
          {TIPUS_KODOK.map((t) => (
            <button
              key={t}
              className={`chip${tipusHalmaz.has(t) ? ' aktiv' : ''}`}
              onClick={() => tipusValt(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="lista">
        {isLoading && <Betolto />}
        {isError && <Hiba uzenet={(error as Error).message} />}
        {data && talalatok.length === 0 && (
          <div className="lista-ures">
            Nincs a szűrésnek megfelelő elem.
            <br />
            Módosítsd a keresést vagy a szűrőket.
          </div>
        )}
        {talalatok.map((e) => {
          const ver = elsodlegesVerzio(e);
          const masodlagos = e.verziok.filter(
            (v) => v.verzioSzam !== ver.verzioSzam && !['Elvetve', 'Archivált'].includes(v.statusz),
          );
          return (
            <button
              key={e.id}
              className={`lista-elem${aktivId === e.id ? ' kivalasztott' : ''}`}
              onClick={() => nav(`/elem/${e.id}?${params.toString()}`)}
            >
              <div className="le-sor1">
                <span className="lista-kulcs">{e.kulcs}</span>
                <span className="tolto" />
                <span className={`badge mini b-${ver.statusz}`}>{ver.statusz}</span>
              </div>
              <div className="lista-cim">{ver.cim}</div>
              <div className="lista-meta">
                <span>
                  {e.tipusKod}
                  {e.retegKod ? ` · ${e.retegKod}` : ''}
                </span>
                {masodlagos.map((v) => (
                  <span key={v.verzioSzam} className={`badge mini b-${v.statusz}`}>
                    v{v.verzioSzam} {v.statusz}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function AlkChipek({ alk, onValt }: { alk: string; onValt: (kod: string) => void }) {
  const { data } = useAlkalmazasok();
  return (
    <>
      {(data ?? []).map((a) => (
        <button key={a.kod} className={`chip${alk === a.kod ? ' aktiv' : ''}`} onClick={() => onValt(a.kod)}>
          {a.kod}
        </button>
      ))}
    </>
  );
}
