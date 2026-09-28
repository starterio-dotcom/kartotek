import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { szabad, jogiZarolasTiltja, KAPCSOLAT_FAJTAK, type KapcsolatFajta } from '@kartotek/shared';
import { useElemek, useKapcsolatLetrehozas, useKapcsolatTorles } from '../api/hooks';
import { Modal, Hiba } from '../komponens/ui';
import { hibaSzoveg } from '../api/hibaSzoveg';
import { uzenet } from '../allapot/uzenetek';
import type { Elem, ElemKapcsolatok, ElemOsszegzo, Felhasznalo, Kapcsolat } from '../api/tipusok';
import { ElemValaszto } from '../komponens/ElemValaszto';
import { KAPCSOLAT_LEIRAS } from '../domain/szotar';

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
  const visszaallit = useKapcsolatLetrehozas(elem.id);
  const { data: lista } = useElemek({});
  const osszesElem = lista?.elemek;
  const kulcsMap = useMemo(() => {
    const m = new Map<string, string>();
    (osszesElem ?? []).forEach((e) => m.set(e.id, e.kulcs));
    return m;
  }, [osszesElem]);

  const kezelheto = szabad('kapcsolat.kezelés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });
  // Zárolás alatt új kapcsolat felvehető, a meglévő (bizonyíték) nem törölhető.
  const torolheto = kezelheto && !jogiZarolasTiltja('kapcsolat.törlés', elem.jogiZarolas);

  if (!kapcsolatok) return <div className="torzs"><span className="ures">Betöltés…</span></div>;
  const { kimeno, bejovo } = kapcsolatok;
  const fajtak = [...new Set(kimeno.map((k) => k.fajta))];

  const celCimke = (k: Kapcsolat) =>
    k.celElemId ? (kulcsMap.get(k.celElemId) ?? 'belső elem') : (k.celSzabalyzatKod ?? k.celKulsoLink ?? '—');

  // A törlés azonnali, de a toastból visszavonható (ugyanazokkal az adatokkal újra felvesszük).
  const torol = (k: Kapcsolat) =>
    torles.mutate(k.id, {
      onSuccess: () =>
        uzenet.siker(`Kapcsolat törölve: ${k.fajta} → ${celCimke(k)}`, {
          cimke: 'Visszavonás',
          fut: () =>
            visszaallit.mutate(
              {
                forrasElemId: elem.id,
                fajta: k.fajta,
                ...(k.celElemId ? { celElemId: k.celElemId } : {}),
                ...(k.celSzabalyzatKod ? { celSzabalyzatKod: k.celSzabalyzatKod } : {}),
                ...(k.celKulsoLink ? { celKulsoLink: k.celKulsoLink } : {}),
              },
              {
                onSuccess: () => uzenet.siker(`Kapcsolat visszaállítva: ${k.fajta} → ${celCimke(k)}`),
                onError: (e) => uzenet.hiba(`A kapcsolat nem állítható vissza: ${hibaSzoveg(e)}`),
              },
            ),
        }),
    });

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
                {k.csonk ? (
                  <Csonk />
                ) : k.celElemId ? (
                  <Link className="kapcs-link" to={`/elem/${k.celElemId}`}>{celCimke(k)}</Link>
                ) : (
                  <span className="kapcs-kulso">{celCimke(k)}</span>
                )}
                {torolheto && (
                  <button
                    className="kapcs-torol"
                    title="Kapcsolat törlése"
                    aria-label={`${f} kapcsolat törlése: ${k.csonk ? 'nem látható elem' : celCimke(k)}`}
                    disabled={torles.isPending}
                    onClick={() => torol(k)}
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
              {k.csonk || !k.forrasElemId ? (
                <Csonk />
              ) : (
                <Link className="kapcs-link" to={`/elem/${k.forrasElemId}`}>
                  {kulcsMap.get(k.forrasElemId) ?? 'belső elem'}
                </Link>
              )}{' '}
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

/** Hivatkozás-csonk: a túloldali elem létezik, de olyan alkalmazásban, amelyet nem olvashatsz. */
function Csonk() {
  return (
    <span className="kapcs-kulso" title="A kapcsolt elem olyan alkalmazásban van, amelyhez nincs olvasási jogosultságod.">
      🔒 nem látható elem
    </span>
  );
}

function UjKapcsolatModal({
  elem,
  elemek,
  onBezar,
}: {
  elem: Elem;
  elemek: ElemOsszegzo[];
  onBezar: () => void;
}) {
  const felvesz = useKapcsolatLetrehozas(elem.id);
  const id = useId();
  const [fajta, setFajta] = useState<KapcsolatFajta>('lebontja');
  const [celElemId, setCelElemId] = useState('');
  const [szabalyzatKod, setSzabalyzatKod] = useState('');
  const [kulsoLink, setKulsoLink] = useState('');

  const celKulcs =
    fajta === 'megfelel'
      ? szabalyzatKod
      : fajta === 'hivatkozik' && kulsoLink
        ? kulsoLink
        : (elemek.find((e) => e.id === celElemId)?.kulcs ?? '');

  const kuld = () => {
    const body: Record<string, unknown> = { forrasElemId: elem.id, fajta };
    if (fajta === 'megfelel') body.celSzabalyzatKod = szabalyzatKod;
    else if (fajta === 'hivatkozik' && kulsoLink) body.celKulsoLink = kulsoLink;
    else body.celElemId = celElemId;
    felvesz.mutate(body, {
      onSuccess: () => {
        uzenet.siker(`Kapcsolat felvéve: ${elem.kulcs} ${fajta} → ${celKulcs}`);
        onBezar();
      },
    });
  };

  const ervenyes =
    fajta === 'megfelel' ? !!szabalyzatKod : fajta === 'hivatkozik' ? !!(kulsoLink || celElemId) : !!celElemId;

  return (
    <Modal cim={`Kapcsolat hozzáadása — ${elem.kulcs}`} onBezar={onBezar}>
      <label htmlFor={`${id}-fajta`}>Fajta</label>
      <select id={`${id}-fajta`} value={fajta} onChange={(e) => setFajta(e.target.value as KapcsolatFajta)}>
        {KAPCSOLAT_FAJTAK.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <p className="mezo-sugo">{KAPCSOLAT_LEIRAS[fajta]}</p>

      {fajta === 'megfelel' ? (
        <>
          <label htmlFor={`${id}-szabalyzat`}>Szabályzat kódja</label>
          <input
            id={`${id}-szabalyzat`}
            type="text"
            value={szabalyzatKod}
            onChange={(e) => setSzabalyzatKod(e.target.value)}
            placeholder="pl. IB-XYT-14-1213"
          />
        </>
      ) : (
        <>
          <label htmlFor={`${id}-cel`}>Cél elem</label>
          <ElemValaszto id={`${id}-cel`} elemek={elemek} ertek={celElemId} onValaszt={setCelElemId} />
          {fajta === 'hivatkozik' && (
            <>
              <label htmlFor={`${id}-link`}>vagy külső link</label>
              <input
                id={`${id}-link`}
                type="text"
                value={kulsoLink}
                onChange={(e) => setKulsoLink(e.target.value)}
                placeholder="https://…"
              />
            </>
          )}
        </>
      )}

      {/* Az irány kiírva — a „ki bont le kit" a legtöbbször összekevert részlet. */}
      <p className="kapcs-irany" aria-live="polite">
        <b>{elem.kulcs}</b> <span className="kapcs-irany-fajta">{fajta}</span> →{' '}
        <b>{celKulcs || '…'}</b>
      </p>

      {felvesz.isError && <Hiba uzenet={hibaSzoveg(felvesz.error)} />}

      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onBezar}>Mégse</button>
        <button className="btn" disabled={!ervenyes || felvesz.isPending} onClick={kuld}>Hozzáadás</button>
      </div>
    </Modal>
  );
}
