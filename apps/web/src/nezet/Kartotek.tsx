import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { szabad, uzletiTipus } from '@kartotek/shared';
import { useElem, useElemKapcsolatok, useFelhasznalok } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { Betolto, Hiba } from '../komponens/ui';
import { Markdown } from '../komponens/Markdown';
import { GazdagNezet } from '../komponens/GazdagNezet';
import { Stepper } from '../komponens/Stepper';
import { LeptetoGombok } from './LeptetoGombok';
import { JogiZarolasSav } from './JogiZarolasSav';
import { Velemenyezes } from './Velemenyezes';
import { Szerkeszto } from './Szerkeszto';
import { Mellekletek } from './Mellekletek';
import { CimkeSzerk } from './CimkeSzerk';
import { KapcsolatSzerk } from './KapcsolatSzerk';
import { HatasPanel, KiadasPanel, VeszelyZona } from './KartotekFazis6';
import { VerzioDiff } from '../komponens/VerzioDiff';
import type { Verzio } from '../api/tipusok';
import { TIPUS_NEV, RETEG_NEV } from '../domain/szotar';
import { alapVerzio, verzioKontextus } from '../domain/verzio';

const datumHu = (d: string | null) => (d ? new Date(d).toLocaleDateString('hu-HU') : '—');

function autoHint(v: Verzio): string | null {
  if (v.statusz === 'Jóváhagyott' && v.hatalyKezdet)
    return `Hatályba lép: ${datumHu(v.hatalyKezdet)} (az ütemező lépteti)`;
  if (v.statusz === 'Hatályos' && v.hatalyVeg)
    return `Hatályát veszti: ${datumHu(v.hatalyVeg)} (az ütemező lépteti)`;
  return null;
}

export function Kartotek() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { felhasznalo } = useAuth();
  const { data: elem, isLoading, isError, error } = useElem(id);
  const { data: kapcsolatok } = useElemKapcsolatok(id);
  const { data: felhasznalok } = useFelhasznalok();
  const nevMap = useMemo(() => {
    const m = new Map<string, string>();
    (felhasznalok ?? []).forEach((f) => m.set(f.id, f.nev));
    return m;
  }, [felhasznalok]);
  // A verzió az URL-ben is (`?v=2`): mélylink, és az értesítés a megfelelő verziót nyitja.
  const [valasztottV, setValasztottV] = useState<number | null>(() => Number(params.get('v')) || null);
  const [szerkeszt, setSzerkeszt] = useState(false);
  const [osszevetV, setOsszevetV] = useState<number | null>(null);

  if (isLoading) return <Betolto />;
  if (isError) return <Hiba uzenet={(error as Error).message} />;
  if (!elem || !felhasznalo) return null;

  const verziok = [...elem.verziok].sort((a, b) => b.verzioSzam - a.verzioSzam);
  const ver: Verzio = verziok.find((v) => v.verzioSzam === valasztottV) ?? alapVerzio(elem, felhasznalo);
  const kontextus = verzioKontextus(elem, ver);
  const valaszt = (v: number) => {
    setValasztottV(v);
    setOsszevetV(null);
    const uj = new URLSearchParams(params);
    uj.set('v', String(v));
    setParams(uj, { replace: true });
  };
  // Verzió-összehasonlítás: a kiválasztott `ver` és egy másik verzió (régi → új sorrendben).
  const osszevetMasik = osszevetV != null ? verziok.find((v) => v.verzioSzam === osszevetV) : null;
  const [diffRegi, diffUj] =
    osszevetMasik && osszevetMasik.verzioSzam < ver.verzioSzam
      ? [osszevetMasik, ver]
      : [ver, osszevetMasik ?? ver];
  const tipusKod = elem.tipusKod;
  const dokumentum = tipusKod === 'BD' || tipusKod === 'TD';
  const uzleti = uzletiTipus(tipusKod);
  const hint = autoHint(ver);

  const szerkesztheto =
    ver.statusz === 'Vázlat' &&
    szabad('vázlat.szerkesztés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });

  const tm = (ver.tipusMezok ?? {}) as {
    rovid?: string;
    elofeltetelek?: string;
    kriteriumok?: string;
    cia?: { c: number; i: number; a: number } | null;
  };

  const mellKontextus = { elemId: elem.id, verzioSzam: ver.verzioSzam, mellekletek: ver.mellekletek };
  const morzsaParams = (() => {
    const p = new URLSearchParams(params);
    p.delete('v');
    return p.toString();
  })();

  return (
    <>
      <div className="reszlet-fej">
        <div className="rf-felso">
          <div className="rf-cimblokk">
            <div className="morzsa-sor">
              <button onClick={() => nav(`/?${morzsaParams}`)}>Áttekintés</button>
              <span>/</span>
              <button onClick={() => nav(`/?alk=${elem.alkalmazasKod}`)}>{elem.alkalmazasKod}</button>
              <span>/</span>
              <span className="kulcs-chip">
                {elem.kulcs} <span style={{ color: 'var(--t-leges)' }}>v{ver.verzioSzam}</span>
              </span>
            </div>
            <h2 className="reszlet-cim">{ver.cim}</h2>
            <div className="reszlet-altipus">
              {TIPUS_NEV[tipusKod] ?? tipusKod}
              {elem.retegKod ? ` · ${elem.retegKod} réteg${RETEG_NEV[elem.retegKod] !== elem.retegKod ? ` (${RETEG_NEV[elem.retegKod]})` : ''}` : ''} · {uzleti ? 'üzleti elem' : 'technikai elem'}
            </div>
          </div>
          <div className="rf-akciok">
            <LeptetoGombok
              elem={elem}
              verzio={ver}
              felhasznalo={felhasznalo}
              onUjVerzio={valaszt}
            />
          </div>
        </div>
        <Stepper statusz={ver.statusz} />
        <JogiZarolasSav elem={elem} felhasznalo={felhasznalo} />
      </div>

      <div className="reszlet-test">
        <div className="tartalom">
          {szerkeszt && szerkesztheto ? (
            <div className="blokk szerk-blokk">
              <Szerkeszto elem={elem} verzio={ver} onKesz={() => setSzerkeszt(false)} />
            </div>
          ) : osszevetMasik ? (
            <>
              <button
                className="gomb masodlagos kicsi"
                style={{ marginBottom: 12 }}
                onClick={() => setOsszevetV(null)}
              >
                ✕ Vissza a tartalomhoz
              </button>
              <VerzioDiff regi={diffRegi} uj={diffUj} />
            </>
          ) : (
            <>
              {kontextus && (
                <div className="verzio-kontextus" role="note">
                  <span>{kontextus.szoveg}</span>
                  <button className="gomb masodlagos kicsi" onClick={() => valaszt(kontextus.cel)}>
                    Megnézem: v{kontextus.cel}
                  </button>
                </div>
              )}
              <div className="blokk">
                <div className="blokk-cim">Rövid leírás</div>
                <div className="torzs">
                  {tm.rovid || <span className="ures">Nincs kitöltve.</span>}
                </div>
              </div>

              <div className="blokk">
                <div className="blokk-cim blokk-cim-sor">
                  Részletes leírás
                  {szerkesztheto ? (
                    <button className="szerk-gomb" onClick={() => setSzerkeszt(true)}>
                      Szerkesztés
                    </button>
                  ) : ver.statusz !== 'Vázlat' ? (
                    <span className="zar-hint" title="A tartalom csak Vázlat státuszban szerkeszthető — módosításhoz nyiss új verziót.">
                      🔒 csak Vázlatban szerkeszthető
                    </span>
                  ) : null}
                </div>
                <div className="torzs">
                  <GazdagNezet leiras={ver.leiras} leirasMd={ver.leirasMd} melleklet={mellKontextus} />
                </div>
              </div>

              {dokumentum && tm.cia ? (
                <div className="blokk">
                  <div className="blokk-cim">CIA besorolás</div>
                  <div className="cia-racs">
                    <div className="cia-cella"><b>{tm.cia.c}</b><span>BIZALMASSÁG</span></div>
                    <div className="cia-cella"><b>{tm.cia.i}</b><span>SÉRTETLENSÉG</span></div>
                    <div className="cia-cella"><b>{tm.cia.a}</b><span>RENDELKEZÉSRE ÁLLÁS</span></div>
                  </div>
                </div>
              ) : !dokumentum ? (
                <div className="ketted">
                  <div className="blokk">
                    <div className="blokk-cim">Előfeltételek</div>
                    <div className="torzs">
                      {tm.elofeltetelek ? (
                        <Markdown szoveg={tm.elofeltetelek} melleklet={mellKontextus} />
                      ) : (
                        <span className="ures">Nincs megadva.</span>
                      )}
                    </div>
                  </div>
                  <div className="blokk">
                    <div className="blokk-cim">Kritériumok</div>
                    <div className="torzs">
                      {tm.kriteriumok ? (
                        <Markdown szoveg={tm.kriteriumok} melleklet={mellKontextus} />
                      ) : (
                        <span className="ures">Nincs megadva.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="blokk">
                <div className="blokk-cim">Véleményezés</div>
                <Velemenyezes elem={elem} verzio={ver} />
              </div>
            </>
          )}
        </div>

        <div className="oldalsav">
          <div className="blokk">
            <div className="blokk-cim">Verziók</div>
            <div className="verzio-lista">
              {verziok.map((v) => (
                <button
                  key={v.verzioSzam}
                  className={`verzio-tab${v.verzioSzam === ver.verzioSzam ? ' aktiv' : ''}`}
                  aria-pressed={v.verzioSzam === ver.verzioSzam}
                  // Szerkesztés közben a verzióváltás elvinné a mentetlen munkát.
                  disabled={szerkeszt && v.verzioSzam !== ver.verzioSzam}
                  title={szerkeszt ? 'Szerkesztés közben nem válthatsz verziót — előbb ments, vagy lépj ki.' : undefined}
                  onClick={() => valaszt(v.verzioSzam)}
                >
                  <span className="vszam">v{v.verzioSzam}</span>
                  <span className="tolto" />
                  <span className={`badge mini b-${v.statusz}`}>{v.statusz}</span>
                </button>
              ))}
            </div>
            {verziok.length > 1 && (
              <label className="osszevet-valaszto">
                <span>Összevetés a v{ver.verzioSzam}-vel:</span>
                <select
                  disabled={szerkeszt}
                  value={osszevetV ?? ''}
                  onChange={(e) => setOsszevetV(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">—</option>
                  {verziok
                    .filter((v) => v.verzioSzam !== ver.verzioSzam)
                    .map((v) => (
                      <option key={v.verzioSzam} value={v.verzioSzam}>
                        v{v.verzioSzam} ({v.statusz})
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>

          <div className="blokk">
            <div className="blokk-cim">Hatályosság</div>
            {ver.hatalyKezdet ? (
              <>
                <div className="hataly-sor">
                  <span>Kezdete<b>{datumHu(ver.hatalyKezdet)}</b></span>
                  <span style={{ textAlign: 'right' }}>
                    Vége<b className={ver.hatalyVeg ? '' : 'visszavonasig'}>{ver.hatalyVeg ? datumHu(ver.hatalyVeg) : 'visszavonásig'}</b>
                  </span>
                </div>
                <div className="hataly-vonal">
                  <div className={`toltes${ver.hatalyVeg ? '' : ' nyitott'}`} />
                </div>
              </>
            ) : (
              <div className="torzs"><span className="ures">Jóváhagyáskor kerül megadásra.</span></div>
            )}
            {hint && (
              <div className="auto-hint"><span>⏱</span><span>{hint}</span></div>
            )}
          </div>

          <div className="blokk">
            <div className="blokk-cim">Mellékletek · {ver.mellekletek.length}</div>
            <Mellekletek elem={elem} verzio={ver} />
          </div>

          <div className="blokk">
            <div className="blokk-cim">Kapcsolatok</div>
            <KapcsolatSzerk elem={elem} kapcsolatok={kapcsolatok} felhasznalo={felhasznalo} />
          </div>

          <HatasPanel elem={elem} />

          <KiadasPanel elem={elem} verzio={ver} felhasznalo={felhasznalo} />

          <div className="blokk">
            <CimkeSzerk elem={elem} felhasznalo={felhasznalo} />
          </div>

          <div className="blokk">
            <div className="blokk-cim">Audit</div>
            <div className="audit-sor">
              <span>Létrehozva · {datumHu(ver.letrehozva)}</span>
              <span>Verzió · v{ver.verzioSzam} / {elem.verziok.length}</span>
            </div>
          </div>

          <details className="blokk osszecsuk" open>
            <summary className="blokk-cim">Napló</summary>
            <div className="ido-lista">
              {[...ver.statusznaplo].reverse().map((n, i) => (
                <div className="ido-sor" key={i}>
                  <span className="ido-pont" style={{ background: n.hova === 'Elvetve' ? '#D6220F' : '#5C6677' }} />
                  <div className="ido-tartalom">
                    <div className="ido-cim">{(n.honnan ?? '—') + ' → ' + n.hova}</div>
                    <div className="ido-meta">
                      {new Date(n.mikor).toLocaleString('hu-HU')} ·{' '}
                      {n.ki === 'RENDSZER' ? (
                        <span className="naplo-rendszer">RENDSZER</span>
                      ) : (
                        (nevMap.get(n.ki) ?? n.ki.slice(-6))
                      )}
                    </div>
                    {n.indoklas && <div className="ido-megj">{n.indoklas}</div>}
                  </div>
                </div>
              ))}
            </div>
          </details>

          <VeszelyZona elem={elem} felhasznalo={felhasznalo} />
        </div>
      </div>
    </>
  );
}

