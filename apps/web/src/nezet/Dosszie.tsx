import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { STATUSZOK, uzletiTipus, lefedetlenBus, type Statusz, type TipusKod } from '@kartotek/shared';
import { useElemek, useGraf, useAlkalmazasok, useSzolgaltatasok } from '../api/hooks';
import { Betolto, Hiba } from '../komponens/ui';
import { GazdagNezet } from '../komponens/GazdagNezet';
import { Markdown } from '../komponens/Markdown';
import type { Elem, Verzio } from '../api/tipusok';

const TIPUS_NEV: Record<TipusKod, string> = {
  BUS: 'Üzleti User Story',
  TUC: 'Technikai Use Case',
  F: 'Feature',
  TUS: 'Technikai User Story',
  BD: 'Üzleti dokumentum',
  TD: 'Technikai dokumentum',
};

const datumHu = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('hu-HU') : '—';

type Mod = 'hatalyos' | 'legujabb';

interface FaElem {
  elem: Elem;
  verzio: Verzio;
  melyseg: number;
  szuloId: string | null;
  vanGyerek: boolean;
}

interface SorrendEredmeny {
  sorrend: FaElem[];
  /** elemId → az ÖSSZES lebontó szülő kulcsa (>1 jelzi a több-szülős elemet). */
  szulok: Map<string, string[]>;
}

/** A dossziéban megjelenítendő verzió: Hatályos módban a legmagasabb Hatályos
 *  verzió (ha van), egyébként a legmagasabb sorszámú (munkapéldány). */
function dosszieVerzio(elem: Elem, mod: Mod): Verzio | null {
  const sorrend = [...elem.verziok].sort((a, b) => b.verzioSzam - a.verzioSzam);
  if (mod === 'hatalyos') return sorrend.find((v) => v.statusz === 'Hatályos') ?? null;
  return sorrend[0] ?? null;
}

/**
 * Az alkalmazás elemeit a `lebontja`-fa szerint mélységi sorrendbe rendezi.
 * A gyökerek (nincs bejövő lebontja-él a hatókörön belül) kulcs szerint, a
 * BUS-ok elöl; a gyerekek kulcs szerint. DAG: minden elem egyszer jelenik meg,
 * az ELSŐ szülője alatt; a többi szülőt a `szulok` map rögzíti.
 */
function lebontasSorrend(
  elemek: Elem[],
  lebontjaElek: { forras: string; cel: string }[],
  mod: Mod,
): SorrendEredmeny {
  const verzioMap = new Map<string, Verzio>();
  for (const e of elemek) {
    const v = dosszieVerzio(e, mod);
    if (v) verzioMap.set(e.id, v);
  }
  const lathato = elemek.filter((e) => verzioMap.has(e.id));
  const idHalmaz = new Set(lathato.map((e) => e.id));
  const elemMap = new Map(lathato.map((e) => [e.id, e]));

  // Csak a hatókörön belüli élek számítanak.
  const elek = lebontjaElek.filter((x) => idHalmaz.has(x.forras) && idHalmaz.has(x.cel));
  const gyerekek = new Map<string, string[]>();
  const szulok = new Map<string, string[]>();
  for (const e of elek) {
    const gy = gyerekek.get(e.forras) ?? [];
    gy.push(e.cel);
    gyerekek.set(e.forras, gy);
    const sz = szulok.get(e.cel) ?? [];
    sz.push(e.forras);
    szulok.set(e.cel, sz);
  }

  const rendez = (idk: string[]) =>
    [...idk].sort((a, b) => {
      const ea = elemMap.get(a)!;
      const eb = elemMap.get(b)!;
      const ua = uzletiTipus(ea.tipusKod) ? 0 : 1;
      const ub = uzletiTipus(eb.tipusKod) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return ea.kulcs.localeCompare(eb.kulcs, 'hu');
    });

  const gyokerek = rendez(lathato.filter((e) => !szulok.has(e.id)).map((e) => e.id));
  const sorrend: FaElem[] = [];
  const latott = new Set<string>();

  const bejar = (id: string, melyseg: number, szuloId: string | null) => {
    if (latott.has(id)) return;
    latott.add(id);
    const gyk = rendez(gyerekek.get(id) ?? []);
    sorrend.push({
      elem: elemMap.get(id)!,
      verzio: verzioMap.get(id)!,
      melyseg,
      szuloId,
      vanGyerek: gyk.length > 0,
    });
    for (const gy of gyk) bejar(gy, melyseg + 1, id);
  };
  for (const g of gyokerek) bejar(g, 0, null);
  // Biztonsági háló: ciklus/elszigeteltség miatt kimaradt elemek a végére.
  for (const e of lathato) if (!latott.has(e.id)) bejar(e.id, 0, null);

  // A szülő-id-ket kulcsra fordítjuk a megjelenítéshez.
  const szulokKulcs = new Map<string, string[]>();
  for (const [id, szIdk] of szulok) {
    szulokKulcs.set(
      id,
      szIdk.map((s) => elemMap.get(s)?.kulcs ?? s),
    );
  }
  return { sorrend, szulok: szulokKulcs };
}

function ErettsegSav({ szamlalo, ossz }: { szamlalo: Map<Statusz, number>; ossz: number }) {
  return (
    <div className="d-erettseg-sav" role="img" aria-label="Érettség státuszok szerint">
      {STATUSZOK.filter((s) => szamlalo.get(s)).map((s) => (
        <div
          key={s}
          className={`d-sav-szel b-${s}`}
          style={{ flex: szamlalo.get(s) }}
          title={`${s}: ${szamlalo.get(s)} / ${ossz}`}
        />
      ))}
    </div>
  );
}

/** Összecsukható tartalomjegyzék — a `lebontja`-fa mentén; ugrás a szakaszokhoz. */
function Toc({
  sorrend,
  szuloMap,
  csukott,
  onCsuk,
  onUgras,
}: {
  sorrend: FaElem[];
  szuloMap: Map<string, string | null>;
  csukott: Set<string>;
  onCsuk: (id: string) => void;
  onUgras: (id: string) => void;
}) {
  const rejtett = (id: string) => {
    let p = szuloMap.get(id) ?? null;
    while (p) {
      if (csukott.has(p)) return true;
      p = szuloMap.get(p) ?? null;
    }
    return false;
  };
  return (
    <nav className="d-toc no-print" aria-label="Tartalomjegyzék">
      <div className="d-toc-cim">Tartalom</div>
      <div className="d-toc-lista">
        {sorrend
          .filter((f) => !rejtett(f.elem.id))
          .map((f) => (
            <div
              key={f.elem.id}
              className="d-toc-sor"
              style={{ paddingLeft: Math.min(f.melyseg, 4) * 13 }}
            >
              {f.vanGyerek ? (
                <button
                  className="d-toc-csuk"
                  aria-label={csukott.has(f.elem.id) ? 'Kibont' : 'Összecsuk'}
                  onClick={() => onCsuk(f.elem.id)}
                >
                  {csukott.has(f.elem.id) ? '▸' : '▾'}
                </button>
              ) : (
                <span className="d-toc-csuk-ures" />
              )}
              <button className="d-toc-link" onClick={() => onUgras(f.elem.id)} title={f.elem.kulcs}>
                <span className={`d-pont b-${f.verzio.statusz}`} />
                <span className="d-toc-kulcs">{f.elem.kulcs}</span>
                <span className="d-toc-cim2">{f.verzio.cim}</span>
              </button>
            </div>
          ))}
      </div>
    </nav>
  );
}

function ElemSzakasz({ fa, szulok }: { fa: FaElem; szulok: string[] }) {
  const { elem, verzio, melyseg } = fa;
  const uzleti = uzletiTipus(elem.tipusKod);
  const dokumentum = elem.tipusKod === 'BD' || elem.tipusKod === 'TD';
  const tm = verzio.tipusMezok as {
    rovid?: string;
    elofeltetelek?: string;
    kriteriumok?: string;
    cia?: { c: number; i: number; a: number } | null;
  };
  const mellKontextus = { elemId: elem.id, verzioSzam: verzio.verzioSzam, mellekletek: verzio.mellekletek };
  const tobbSzulos = szulok.length > 1;

  return (
    <section id={`d-${elem.id}`} className="d-szakasz" style={{ marginLeft: Math.min(melyseg, 4) * 22 }}>
      <div className="d-szakasz-fej">
        <span className="d-kulcs">{elem.kulcs}</span>
        <span className={`badge mini b-${verzio.statusz}`}>{verzio.statusz}</span>
        <span className="d-vszam">v{verzio.verzioSzam}</span>
        {tobbSzulos && (
          <span className="d-tobbszulo" title={`Több helyen lebontva: ${szulok.join(', ')}`}>
            ⑂ több szülő ({szulok.length})
          </span>
        )}
        <Link className="d-link" to={`/elem/${elem.id}`} title="Megnyitás a kartotékban">
          ↗
        </Link>
      </div>
      <h3 className="d-cim">{verzio.cim}</h3>
      <div className="d-altipus">
        {TIPUS_NEV[elem.tipusKod] ?? elem.tipusKod}
        {elem.retegKod ? ` · ${elem.retegKod} réteg` : ''} · {uzleti ? 'üzleti elem' : 'technikai elem'}
        {verzio.hatalyKezdet ? ` · hatályos ${datumHu(verzio.hatalyKezdet)}-tól` : ''}
      </div>
      {tobbSzulos && (
        <div className="d-tobbszulo-sor">Lebontó szülők: {szulok.join(', ')}</div>
      )}

      {tm.rovid && <p className="d-rovid">{tm.rovid}</p>}

      <div className="d-tartalom">
        <GazdagNezet leiras={verzio.leiras} leirasMd={verzio.leirasMd} melleklet={mellKontextus} />
      </div>

      {dokumentum && tm.cia ? (
        <div className="cia-racs d-cia">
          <div className="cia-cella"><b>{tm.cia.c}</b><span>BIZALMASSÁG</span></div>
          <div className="cia-cella"><b>{tm.cia.i}</b><span>SÉRTETLENSÉG</span></div>
          <div className="cia-cella"><b>{tm.cia.a}</b><span>RENDELKEZÉSRE ÁLLÁS</span></div>
        </div>
      ) : !dokumentum && (tm.elofeltetelek || tm.kriteriumok) ? (
        <div className="d-ketted">
          {tm.elofeltetelek && (
            <div>
              <div className="d-mezo-cim">Előfeltételek</div>
              <Markdown szoveg={tm.elofeltetelek} melleklet={mellKontextus} />
            </div>
          )}
          {tm.kriteriumok && (
            <div>
              <div className="d-mezo-cim">Kritériumok</div>
              <Markdown szoveg={tm.kriteriumok} melleklet={mellKontextus} />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function Dosszie() {
  const [params] = useSearchParams();
  const alk = params.get('alk') ?? '';
  const [mod, setMod] = useState<Mod>('hatalyos');
  const [csukott, setCsukott] = useState<Set<string>>(new Set());

  const { data: alkalmazasok } = useAlkalmazasok();
  const { data: szolgaltatasok } = useSzolgaltatasok();
  const { data: elemek, isLoading, isError, error } = useElemek({ alkalmazasKod: alk });
  const { data: graf } = useGraf(alk);

  const alkalmazas = (alkalmazasok ?? []).find((a) => a.kod === alk);
  const szolg =
    (szolgaltatasok ?? []).find((s) => s.kod === alkalmazas?.szolgaltatasKod) ?? szolgaltatasok?.[0];

  const lebontjaElek = useMemo(
    () =>
      (graf?.elek ?? [])
        .filter((e) => e.fajta === 'lebontja')
        .map((e) => ({ forras: e.forras, cel: e.cel })),
    [graf],
  );
  const { sorrend, szulok } = useMemo(
    () => (elemek ? lebontasSorrend(elemek, lebontjaElek, mod) : { sorrend: [], szulok: new Map() }),
    [elemek, lebontjaElek, mod],
  );

  const szuloMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const f of sorrend) m.set(f.elem.id, f.szuloId);
    return m;
  }, [sorrend]);

  const { szamlalo, fedetlenBusDb } = useMemo(() => {
    const sz = new Map<Statusz, number>();
    for (const f of sorrend) sz.set(f.verzio.statusz, (sz.get(f.verzio.statusz) ?? 0) + 1);
    const idHalmaz = new Set(sorrend.map((f) => f.elem.id));
    const csomopontok = sorrend.map((f) => ({ id: f.elem.id, tipusKod: f.elem.tipusKod }));
    const elek = lebontjaElek.filter((e) => idHalmaz.has(e.forras) && idHalmaz.has(e.cel));
    return { szamlalo: sz, fedetlenBusDb: lefedetlenBus(csomopontok, elek).length };
  }, [sorrend, lebontjaElek]);

  const ugras = (id: string) =>
    document.getElementById(`d-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const csuk = (id: string) =>
    setCsukott((elozo) => {
      const uj = new Set(elozo);
      if (uj.has(id)) uj.delete(id);
      else uj.add(id);
      return uj;
    });

  if (!alk) {
    return (
      <main>
        <div className="d-ures">Válassz alkalmazást az Áttekintésben a dosszié megnyitásához.</div>
      </main>
    );
  }
  if (isLoading) return <main><Betolto /></main>;
  if (isError) return <main><Hiba uzenet={(error as Error).message} /></main>;

  const hatalyosDb = szamlalo.get('Hatályos') ?? 0;
  const busDb = sorrend.filter((f) => f.elem.tipusKod === 'BUS').length;
  const ossz = sorrend.length;

  return (
    <main>
      <div className="dosszie">
        <div className="d-fej">
          <div>
            <span className="d-szolg-cimke">{szolg?.nev ?? 'FAIR'} · üzleti szolgáltatás</span>
            <h2 className="d-fej-cim">{alkalmazas?.nev ?? alk} — specifikáció</h2>
            <p className="d-fej-leiras">{alkalmazas?.leiras}</p>
          </div>
          <div className="d-fej-akciok no-print">
            <div className="d-mod-valto" role="group" aria-label="Tartalom módja">
              <button className={mod === 'hatalyos' ? 'aktiv' : ''} onClick={() => setMod('hatalyos')}>
                Hatályos
              </button>
              <button className={mod === 'legujabb' ? 'aktiv' : ''} onClick={() => setMod('legujabb')}>
                Legújabb
              </button>
            </div>
            <button className="gomb masodlagos" onClick={() => window.print()}>
              ⎙ Nyomtatás / PDF
            </button>
          </div>
        </div>

        <div className="d-osszegzo">
          <div className="d-stat">
            <b>{ossz}</b>
            <span>{mod === 'hatalyos' ? 'hatályos elem' : 'elem'}</span>
          </div>
          <div className="d-stat">
            <b>{hatalyosDb}</b>
            <span>hatályos</span>
          </div>
          <div className="d-stat">
            <b>{busDb}</b>
            <span>üzleti story</span>
          </div>
          <div className={`d-stat${fedetlenBusDb ? ' d-stat-fig' : ''}`}>
            <b>{fedetlenBusDb}</b>
            <span>lefedetlen BUS</span>
          </div>
          <div className="d-erettseg">
            <ErettsegSav szamlalo={szamlalo} ossz={ossz} />
            <div className="d-legend">
              {STATUSZOK.filter((s) => szamlalo.get(s)).map((s) => (
                <span key={s} className="d-legend-tetel">
                  <span className={`d-pont b-${s}`} /> {s} {szamlalo.get(s)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {ossz === 0 ? (
          <div className="d-ures">
            {mod === 'hatalyos'
              ? 'Ennek az alkalmazásnak még nincs hatályos eleme. Válts a „Legújabb" nézetre a munkapéldányokhoz.'
              : 'Ehhez az alkalmazáshoz nincs elem.'}
          </div>
        ) : (
          <div className="d-wrap">
            <Toc
              sorrend={sorrend}
              szuloMap={szuloMap}
              csukott={csukott}
              onCsuk={csuk}
              onUgras={ugras}
            />
            <div className="d-fo">
              {sorrend.map((f) => (
                <ElemSzakasz key={f.elem.id} fa={f} szulok={szulok.get(f.elem.id) ?? []} />
              ))}
            </div>
          </div>
        )}

        <div className="d-labjegyzet">
          A dosszié a <code>lebontja</code>-fa szerinti sorrendben jeleníti meg az elemeket
          {mod === 'hatalyos' ? ' (csak a hatályos verziók)' : ' (a legújabb verziók)'}. A több szülő
          alatt is lebontott elemek ⑂ jelzést kapnak. Generálva ehhez: {alkalmazas?.nev ?? alk}.
        </div>
      </div>
    </main>
  );
}
