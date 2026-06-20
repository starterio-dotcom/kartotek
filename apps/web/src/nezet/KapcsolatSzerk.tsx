import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { szabad, KAPCSOLAT_FAJTAK, type KapcsolatFajta } from '@kartotek/shared';
import { useElemek, useKapcsolatLetrehozas, useKapcsolatTorles } from '../api/hooks';
import { Modal, Hiba } from '../komponens/ui';
import { ApiHiba } from '../api/kliens';
import type { Elem, ElemKapcsolatok, Felhasznalo, Kapcsolat } from '../api/tipusok';

export function KapcsolatSzerk({
  elem,
  kapcsolatok,
  felhasznalo,
}: {
  elem: Elem;
  kapcsolatok: ElemKapcsolatok | undefined;
  felhasznalo: Felhasznalo;
}) {
  const [ujNyitva, setUjNyitva] = useState(false);
  const torles = useKapcsolatTorles(elem.id);
  const { data: osszesElem } = useElemek({});
  const kulcsMap = useMemo(() => {
    const m = new Map<string, string>();
    (osszesElem ?? []).forEach((e) => m.set(e.id, e.kulcs));
    return m;
  }, [osszesElem]);

  const kezelheto = szabad('kapcsolat.kezelés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });

  if (!kapcsolatok) return <div className="torzs"><span className="ures">Betöltés…</span></div>;
  const { kimeno, bejovo } = kapcsolatok;
  const fajtak = [...new Set(kimeno.map((k) => k.fajta))];

  const celCimke = (k: Kapcsolat) =>
    k.celElemId ? (kulcsMap.get(k.celElemId) ?? 'belső elem') : (k.celSzabalyzatKod ?? k.celKulsoLink ?? '—');

  return (
    <>
      {!kimeno.length && !bejovo.length && (
        <div className="torzs"><span className="ures">Nincs kapcsolat.</span></div>
      )}

      {fajtak.map((f) => (
        <div className="kapcs-csoport" key={f}>
          <span className="kapcs-fajta">{f}</span>
          {kimeno
            .filter((k) => k.fajta === f)
            .map((k) => (
              <div className="kapcs-sor-szerk" key={k.id}>
                {k.celElemId ? (
                  <Link className="kapcs-link" to={`/elem/${k.celElemId}`}>{celCimke(k)}</Link>
                ) : (
                  <span className="kapcs-kulso">{celCimke(k)}</span>
                )}
                {kezelheto && (
                  <button
                    className="kapcs-torol"
                    title="Kapcsolat törlése"
                    disabled={torles.isPending}
                    onClick={() => torles.mutate(k.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
        </div>
      ))}

      {bejovo.length > 0 && (
        <div className="bejovo">
          Erre hivatkozik:{' '}
          {bejovo.map((k, i) => (
            <span key={k.id}>
              {i > 0 && ' · '}
              <Link className="kapcs-link" to={`/elem/${k.forrasElemId}`}>
                {kulcsMap.get(k.forrasElemId) ?? 'belső elem'}
              </Link>{' '}
              <span style={{ color: 'var(--t-leges)' }}>({k.fajta})</span>
            </span>
          ))}
        </div>
      )}

      {kezelheto && (
        <button className="kapcs-add" onClick={() => setUjNyitva(true)}>
          + Kapcsolat hozzáadása
        </button>
      )}

      {ujNyitva && (
        <UjKapcsolatModal
          elem={elem}
          elemek={(osszesElem ?? []).filter((e) => e.id !== elem.id)}
          onBezar={() => setUjNyitva(false)}
        />
      )}
    </>
  );
}

function UjKapcsolatModal({
  elem,
  elemek,
  onBezar,
}: {
  elem: Elem;
  elemek: Elem[];
  onBezar: () => void;
}) {
  const felvesz = useKapcsolatLetrehozas(elem.id);
  const [fajta, setFajta] = useState<KapcsolatFajta>('lebontja');
  const [celElemId, setCelElemId] = useState('');
  const [szabalyzatKod, setSzabalyzatKod] = useState('');
  const [kulsoLink, setKulsoLink] = useState('');

  const kuld = () => {
    const body: Record<string, unknown> = { forrasElemId: elem.id, fajta };
    if (fajta === 'megfelel') body.celSzabalyzatKod = szabalyzatKod;
    else if (fajta === 'hivatkozik' && kulsoLink) body.celKulsoLink = kulsoLink;
    else body.celElemId = celElemId;
    felvesz.mutate(body, { onSuccess: onBezar });
  };

  const ervenyes =
    fajta === 'megfelel' ? !!szabalyzatKod : fajta === 'hivatkozik' ? !!(kulsoLink || celElemId) : !!celElemId;

  return (
    <Modal cim="Kapcsolat hozzáadása" onBezar={onBezar}>
      <label>Fajta</label>
      <select value={fajta} onChange={(e) => setFajta(e.target.value as KapcsolatFajta)}>
        {KAPCSOLAT_FAJTAK.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>

      {fajta === 'megfelel' ? (
        <>
          <label>Szabályzat kódja</label>
          <input value={szabalyzatKod} onChange={(e) => setSzabalyzatKod(e.target.value)} placeholder="pl. IB-XYT-14-1213" />
        </>
      ) : (
        <>
          <label>Cél elem</label>
          <select value={celElemId} onChange={(e) => setCelElemId(e.target.value)}>
            <option value="">— válassz —</option>
            {elemek.map((e) => (
              <option key={e.id} value={e.id}>
                {e.kulcs}
              </option>
            ))}
          </select>
          {fajta === 'hivatkozik' && (
            <>
              <label>vagy külső link</label>
              <input value={kulsoLink} onChange={(e) => setKulsoLink(e.target.value)} placeholder="https://…" />
            </>
          )}
        </>
      )}

      {felvesz.isError && <Hiba uzenet={hibaSzoveg(felvesz.error)} />}

      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onBezar}>Mégse</button>
        <button className="btn" disabled={!ervenyes || felvesz.isPending} onClick={kuld}>Hozzáadás</button>
      </div>
    </Modal>
  );
}

function hibaSzoveg(err: unknown): string {
  const e = err as ApiHiba;
  const reszletek = Array.isArray(e.reszletek) ? ` (${(e.reszletek as string[]).join(' ')})` : '';
  return e.message + reszletek;
}
