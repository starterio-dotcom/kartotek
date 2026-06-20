import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KAPCSOLAT_FAJTAK, type KapcsolatFajta } from '@kartotek/shared';
import { useGraf } from '../api/hooks';
import { api, ApiHiba } from '../api/kliens';
import { Betolto, Hiba } from '../komponens/ui';
import { elrendez, kornyezet, EL_STILUS, NODE_W, NODE_H, type PozCsomopont } from '../domain/graf';

export function Graf() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const alk = params.get('alk') ?? '';
  const qc = useQueryClient();
  const { data: graf, isLoading, isError, error } = useGraf(alk);

  const [aktivFajtak, setAktivFajtak] = useState<Set<KapcsolatFajta>>(new Set(KAPCSOLAT_FAJTAK));
  const [kijelolt, setKijelolt] = useState<string | null>(null);
  const [csakKornyezet, setCsakKornyezet] = useState(false);
  const [nezet, setNezet] = useState({ scale: 1, tx: 0, ty: 0 });
  const huzas = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const mozgott = useRef(false); // pan közben ne navigáljon a csomópont-kattintás

  const elrendezes = useMemo(() => (graf ? elrendez(graf) : null), [graf]);
  const pozMap = useMemo(() => {
    const m = new Map<string, PozCsomopont>();
    elrendezes?.csomopontok.forEach((c) => m.set(c.id, c));
    return m;
  }, [elrendezes]);

  if (isLoading) return <main><Betolto /></main>;
  if (isError) return <main><Hiba uzenet={(error as Error).message} /></main>;
  if (!graf || !elrendezes) return null;

  const kornyezetSet = csakKornyezet && kijelolt ? kornyezet(graf.elek, kijelolt) : null;
  const lathatoCsomopontok = elrendezes.csomopontok.filter((c) => !kornyezetSet || kornyezetSet.has(c.id));
  const lathatoElek = graf.elek.filter(
    (e) =>
      aktivFajtak.has(e.fajta) &&
      (!kornyezetSet || (kornyezetSet.has(e.forras) && kornyezetSet.has(e.cel))),
  );

  const fajtaValt = (f: KapcsolatFajta) => {
    const uj = new Set(aktivFajtak);
    if (uj.has(f)) uj.delete(f);
    else uj.add(f);
    setAktivFajtak(uj);
  };

  const onWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setNezet((n) => ({ ...n, scale: Math.min(2.5, Math.max(0.3, n.scale * delta)) }));
  };
  const onDown = (e: React.MouseEvent) => {
    huzas.current = { x: e.clientX, y: e.clientY, tx: nezet.tx, ty: nezet.ty };
    mozgott.current = false;
  };
  const onMove = (e: React.MouseEvent) => {
    if (!huzas.current) return;
    if (Math.abs(e.clientX - huzas.current.x) + Math.abs(e.clientY - huzas.current.y) > 4)
      mozgott.current = true;
    setNezet((n) => ({
      ...n,
      tx: huzas.current!.tx + (e.clientX - huzas.current!.x),
      ty: huzas.current!.ty + (e.clientY - huzas.current!.y),
    }));
  };

  // Csomópont-kattintás: elemnél nyíljon meg a kartoték; szabályzatnál (nincs kartoték) kijelölés.
  const csomopontKlikk = (n: PozCsomopont) => {
    if (mozgott.current) return; // ez pan volt, nem kattintás
    if (n.tipus === 'szabalyzat') setKijelolt(n.id);
    else nav(`/elem/${n.id}${alk ? `?alk=${alk}` : ''}`);
  };
  const onUp = () => (huzas.current = null);

  return (
    <div className="graf-wrap">
      <div className="graf-eszkoztar">
        <span className="graf-cim">Kapcsolati gráf{alk ? ` — ${alk}` : ''}</span>
        <label className="hctrl">
          <input
            type="checkbox"
            checked={csakKornyezet}
            disabled={!kijelolt}
            onChange={(e) => setCsakKornyezet(e.target.checked)}
          />
          Csak a kijelölt környezete
        </label>
        <button className="gomb masodlagos" onClick={() => setNezet({ scale: 1, tx: 0, ty: 0 })}>
          Nézet visszaállítása
        </button>
      </div>

      <div className="graf-fo">
        <div
          className="graf-vaszon"
          onWheel={onWheel}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <svg id="grafSvg" width="100%" height="100%">
            <defs>
              <marker id="nyil" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6 Z" fill="#94a3b8" />
              </marker>
            </defs>
            <g transform={`translate(${nezet.tx},${nezet.ty}) scale(${nezet.scale})`}>
              {lathatoElek.map((e) => {
                const f = pozMap.get(e.forras);
                const c = pozMap.get(e.cel);
                if (!f || !c) return null;
                const s = EL_STILUS[e.fajta];
                return (
                  <line
                    key={e.id}
                    className="graf-el"
                    x1={f.x + NODE_W / 2}
                    y1={f.y + NODE_H}
                    x2={c.x + NODE_W / 2}
                    y2={c.y}
                    stroke={s.szin}
                    strokeWidth={s.vastagsag}
                    strokeDasharray={s.dash}
                    markerEnd="url(#nyil)"
                  />
                );
              })}
              {lathatoCsomopontok.map((n) => (
                <g
                  key={n.id}
                  className={`graf-cs${kijelolt === n.id ? ' kijelolt' : ''}`}
                  transform={`translate(${n.x},${n.y})`}
                  onClick={() => csomopontKlikk(n)}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="10"
                    fill={n.tipus === 'szabalyzat' ? '#EEF2FF' : '#ffffff'}
                    stroke={kijelolt === n.id ? '#4258ED' : '#D3D9E3'}
                    strokeWidth={kijelolt === n.id ? 2 : 1}
                  />
                  <text x="13" y="22" fontSize="13" fontWeight="700" fill="#16191F">
                    {n.cimke.length > 20 ? n.cimke.slice(0, 19) + '…' : n.cimke}
                  </text>
                  {n.statusz && (
                    <text x="13" y="40" fontSize="11" fill="#5F6B7D">
                      {n.statusz}
                    </text>
                  )}
                </g>
              ))}
            </g>
          </svg>
        </div>

        <aside className="graf-oldalsav">
          {kijelolt ? (
            <KijeloltPanel graf={graf} kijelolt={kijelolt} pozMap={pozMap} onValtozas={() => void qc.invalidateQueries({ queryKey: ['graf'] })} />
          ) : (
            <p className="mell-meta">Kattints egy csomópontra a részletekhez és a kapcsolatszerkesztéshez.</p>
          )}
        </aside>
      </div>

      <div className="graf-jelmagyarazat">
        <b>Éltípusok</b>
        {KAPCSOLAT_FAJTAK.map((f) => (
          <label key={f} className="graf-chip hctrl">
            <input type="checkbox" checked={aktivFajtak.has(f)} onChange={() => fajtaValt(f)} />
            <span
              className="vonal-minta"
              style={
                {
                  ['--c' as string]: EL_STILUS[f].szin,
                  borderTopStyle: EL_STILUS[f].dash ? 'dashed' : 'solid',
                  borderTopColor: EL_STILUS[f].szin,
                } as React.CSSProperties
              }
            />
            <i>{f}</i>
          </label>
        ))}
      </div>
    </div>
  );
}

function KijeloltPanel({
  graf,
  kijelolt,
  pozMap,
  onValtozas,
}: {
  graf: import('../domain/graf').Graf;
  kijelolt: string;
  pozMap: Map<string, PozCsomopont>;
  onValtozas: () => void;
}) {
  const node = pozMap.get(kijelolt);
  const elem = graf.csomopontok.find((c) => c.id === kijelolt);
  const [cel, setCel] = useState('');
  const [fajta, setFajta] = useState<KapcsolatFajta>('lebontja');

  const felvesz = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { forrasElemId: kijelolt, fajta };
      if (cel.startsWith('sz:')) body.celSzabalyzatKod = cel.slice(3);
      else body.celElemId = cel;
      return api.post('/api/kapcsolatok', body);
    },
    onSuccess: () => {
      setCel('');
      onValtozas();
    },
  });
  const torol = useMutation({
    mutationFn: (kid: string) => api.del(`/api/kapcsolatok/${kid}`),
    onSuccess: onValtozas,
  });

  const sajatElek = graf.elek.filter((e) => e.forras === kijelolt || e.cel === kijelolt);
  const celLista = [
    ...graf.csomopontok.filter((c) => c.id !== kijelolt).map((c) => ({ value: c.id, cimke: c.kulcs })),
    ...graf.szabalyzatok.map((k) => ({ value: `sz:${k}`, cimke: k })),
  ];
  const cimke = (id: string) => pozMap.get(id)?.cimke ?? id;

  return (
    <>
      <div className="kulcs-chip">{node?.cimke}</div>
      {elem && (
        <p style={{ margin: '8px 0' }}>
          <Link className="kapcs-link" to={`/elem/${kijelolt}`}>Kartoték megnyitása →</Link>
        </p>
      )}

      <div className="kapcs-fajta">Kapcsolatok</div>
      {sajatElek.length === 0 && <p className="mell-meta">Nincs.</p>}
      {sajatElek.map((e) => (
        <div className="kapcs-sor-szerk" key={e.id}>
          <span className="kapcs-kulso">
            {e.fajta} {e.forras === kijelolt ? '→' : '←'} {cimke(e.forras === kijelolt ? e.cel : e.forras)}
          </span>
          {elem && (
            <button className="kapcs-torol" title="Törlés" disabled={torol.isPending} onClick={() => torol.mutate(e.id)}>
              ✕
            </button>
          )}
        </div>
      ))}

      {elem && (
        <div style={{ marginTop: 12 }}>
          <div className="kapcs-fajta">Új kapcsolat</div>
          <select className="mezo-be" style={{ marginBottom: 6 }} value={fajta} onChange={(e) => setFajta(e.target.value as KapcsolatFajta)}>
            {KAPCSOLAT_FAJTAK.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select className="mezo-be" value={cel} onChange={(e) => setCel(e.target.value)}>
            <option value="">— cél —</option>
            {celLista.map((o) => (
              <option key={o.value} value={o.value}>
                {o.cimke}
              </option>
            ))}
          </select>
          <button className="kapcs-add" disabled={!cel || felvesz.isPending} onClick={() => felvesz.mutate()}>
            + Hozzáadás
          </button>
          {felvesz.isError && <Hiba uzenet={hibaSzoveg(felvesz.error)} />}
        </div>
      )}
    </>
  );
}

function hibaSzoveg(err: unknown): string {
  const e = err as ApiHiba;
  const reszletek = Array.isArray(e.reszletek) ? ` (${(e.reszletek as string[]).join(' ')})` : '';
  return e.message + reszletek;
}
