import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { JSONContent } from '@tiptap/core';
import { useQueryClient } from '@tanstack/react-query';
import { useVerzioSzerkesztes } from '../api/hooks';
import { Hiba, Megerosites } from '../komponens/ui';
import { GazdagSzerkeszto } from '../komponens/GazdagSzerkeszto';
import { ApiHiba } from '../api/kliens';
import { hibaSzoveg } from '../api/hibaSzoveg';
import { uzenet } from '../allapot/uzenetek';
import type { Elem, Verzio } from '../api/tipusok';

export function Szerkeszto({
  elem,
  verzio,
  onKesz,
}: {
  elem: Elem;
  verzio: Verzio;
  onKesz: () => void;
}) {
  const mentes = useVerzioSzerkesztes(elem.id, verzio.verzioSzam);
  const qc = useQueryClient();
  // Optimista zár: a szerkesztő MEGNYITÁSAKORI revízió az alap (a cache közben frissülhet).
  const [alapRevizio] = useState(() => verzio.revizio ?? 0);
  const tm = (verzio.tipusMezok ?? {}) as { rovid?: string; elofeltetelek?: string; kriteriumok?: string };
  const dokumentum = elem.tipusKod === 'BD' || elem.tipusKod === 'TD';
  // A megnyitáskori értékek — ehhez mérjük, van-e mentetlen módosítás.
  const [kezdo] = useState(() => ({
    rovid: tm.rovid ?? '',
    elofeltetelek: tm.elofeltetelek ?? '',
    kriteriumok: tm.kriteriumok ?? '',
    cimkek: elem.cimkek.join(', '),
  }));
  const [rovid, setRovid] = useState(kezdo.rovid);
  const [elofeltetelek, setElofeltetelek] = useState(kezdo.elofeltetelek);
  const [kriteriumok, setKriteriumok] = useState(kezdo.kriteriumok);
  const [cimkek, setCimkek] = useState(kezdo.cimkek);
  const [leiras, setLeiras] = useState<JSONContent | undefined>(undefined);
  const [elvetesKerdes, setElvetesKerdes] = useState(false);

  const piszkos =
    !mentes.isSuccess &&
    (leiras !== undefined ||
      rovid !== kezdo.rovid ||
      elofeltetelek !== kezdo.elofeltetelek ||
      kriteriumok !== kezdo.kriteriumok ||
      cimkek !== kezdo.cimkek);

  // Mentetlen munka védelme: másik oldalra/elemre lépés (a szűrők ugyanazon az oldalon maradnak) …
  const blokkolo = useBlocker(({ currentLocation, nextLocation }) => piszkos && currentLocation.pathname !== nextLocation.pathname);
  // … és a lap bezárása / újratöltése.
  useEffect(() => {
    if (!piszkos) return;
    const kezelo = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', kezelo);
    return () => window.removeEventListener('beforeunload', kezelo);
  }, [piszkos]);

  const ment = () => {
    mentes.mutate(
      {
        cimkek: cimkek.split(',').map((s) => s.trim()).filter(Boolean),
        tipusMezok: dokumentum ? { ...tm, rovid } : { ...tm, rovid, elofeltetelek, kriteriumok },
        ...(leiras !== undefined ? { leiras } : {}),
        alapRevizio,
      },
      {
        onSuccess: () => {
          uzenet.siker(`Mentve — ${elem.kulcs} v${verzio.verzioSzam}.`);
          onKesz();
        },
      },
    );
  };

  const megse = () => (piszkos ? setElvetesKerdes(true) : onKesz());

  // Ütközés: valaki más közben mentette ugyanezt a verziót (409 + reszletek.aktualisRevizio).
  const utkozes =
    mentes.isError &&
    (mentes.error as ApiHiba).statusCode === 409 &&
    ((mentes.error as ApiHiba).reszletek as { aktualisRevizio?: number } | undefined)
      ?.aktualisRevizio !== undefined;

  const frissitEsBezar = () => {
    void qc.invalidateQueries({ queryKey: ['elem', elem.id] });
    onKesz();
  };

  return (
    <>
      <div className="szerk-fej">
        <span className="blokk-cim" style={{ margin: 0 }}>
          Szerkesztés — v{verzio.verzioSzam} (Vázlat){piszkos && <span className="szerk-piszkos"> · mentetlen módosítás</span>}
        </span>
        <span className="tolto" />
        <button className="gomb masodlagos" onClick={megse}>Mégse</button>
        <button className="gomb elsodleges" disabled={mentes.isPending} onClick={ment}>
          {mentes.isPending ? 'Mentés…' : 'Mentés'}
        </button>
      </div>

      <label className="szerk-cimke" htmlFor="szerkRovid">Rövid leírás</label>
      <input id="szerkRovid" value={rovid} onChange={(e) => setRovid(e.target.value)} />

      <label className="szerk-cimke">Részletes leírás</label>
      <GazdagSzerkeszto
        elemId={elem.id}
        verzioSzam={verzio.verzioSzam}
        ertek={verzio.leiras}
        leirasMd={verzio.leirasMd}
        mellekletek={verzio.mellekletek}
        onChange={setLeiras}
      />

      {!dokumentum && (
        <>
          <label className="szerk-cimke" htmlFor="szerkElofeltetelek">Előfeltételek</label>
          <textarea
            id="szerkElofeltetelek"
            className="szerk-mezo-kicsi"
            spellCheck={false}
            value={elofeltetelek}
            onChange={(e) => setElofeltetelek(e.target.value)}
          />
          <label className="szerk-cimke" htmlFor="szerkKriteriumok">Elfogadási kritériumok</label>
          <textarea
            id="szerkKriteriumok"
            className="szerk-mezo-kicsi"
            spellCheck={false}
            value={kriteriumok}
            onChange={(e) => setKriteriumok(e.target.value)}
          />
        </>
      )}

      <label className="szerk-cimke" htmlFor="szerkCimkek">Címkék (vesszővel)</label>
      <input id="szerkCimkek" className="mezo-be" value={cimkek} onChange={(e) => setCimkek(e.target.value)} />

      {utkozes ? (
        <div className="hiba-doboz" role="alert">
          <b>Mentési ütközés.</b> {(mentes.error as ApiHiba).message}{' '}
          A saját módosításaidat másold ki, mielőtt újratöltesz.{' '}
          <button className="gomb masodlagos" onClick={frissitEsBezar}>
            Legfrissebb változat betöltése
          </button>
        </div>
      ) : (
        mentes.isError && <Hiba uzenet={hibaSzoveg(mentes.error)} />
      )}

      {elvetesKerdes && (
        <Megerosites
          cim="Elveted a módosításokat?"
          gombFelirat="Elvetem"
          veszelyes
          onMegse={() => setElvetesKerdes(false)}
          onMegerosit={() => {
            setElvetesKerdes(false);
            onKesz();
          }}
        >
          A {elem.kulcs} v{verzio.verzioSzam} szerkesztésében mentetlen módosítások vannak. Ha kilépsz, elvesznek.
        </Megerosites>
      )}

      {blokkolo.state === 'blocked' && (
        <Megerosites
          cim="Mentetlen módosítások"
          gombFelirat="Elvetem és továbblépek"
          veszelyes
          onMegse={() => blokkolo.reset()}
          onMegerosit={() => blokkolo.proceed()}
        >
          A {elem.kulcs} v{verzio.verzioSzam} szerkesztésében mentetlen módosítások vannak. Ha továbblépsz, elvesznek —
          előbb érdemes menteni.
        </Megerosites>
      )}
    </>
  );
}
