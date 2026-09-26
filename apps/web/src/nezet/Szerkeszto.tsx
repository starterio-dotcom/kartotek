import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useQueryClient } from '@tanstack/react-query';
import { useVerzioSzerkesztes } from '../api/hooks';
import { Hiba } from '../komponens/ui';
import { GazdagSzerkeszto } from '../komponens/GazdagSzerkeszto';
import { ApiHiba } from '../api/kliens';
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
  const tm = verzio.tipusMezok as { rovid?: string; elofeltetelek?: string; kriteriumok?: string };
  const dokumentum = elem.tipusKod === 'BD' || elem.tipusKod === 'TD';
  const [rovid, setRovid] = useState(tm.rovid ?? '');
  const [elofeltetelek, setElofeltetelek] = useState(tm.elofeltetelek ?? '');
  const [kriteriumok, setKriteriumok] = useState(tm.kriteriumok ?? '');
  const [cimkek, setCimkek] = useState(elem.cimkek.join(', '));
  const [leiras, setLeiras] = useState<JSONContent | undefined>(undefined);

  const ment = () => {
    mentes.mutate(
      {
        cimkek: cimkek.split(',').map((s) => s.trim()).filter(Boolean),
        tipusMezok: dokumentum ? { ...tm, rovid } : { ...tm, rovid, elofeltetelek, kriteriumok },
        ...(leiras !== undefined ? { leiras } : {}),
        alapRevizio,
      },
      { onSuccess: onKesz },
    );
  };

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
          Szerkesztés — v{verzio.verzioSzam} (Vázlat)
        </span>
        <span className="tolto" />
        <button className="gomb masodlagos" onClick={onKesz}>Mégse</button>
        <button className="gomb elsodleges" disabled={mentes.isPending} onClick={ment}>Mentés</button>
      </div>

      <label className="szerk-cimke">Rövid leírás</label>
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
          <label className="szerk-cimke">Előfeltételek</label>
          <textarea
            className="szerk-mezo-kicsi"
            spellCheck={false}
            value={elofeltetelek}
            onChange={(e) => setElofeltetelek(e.target.value)}
          />
          <label className="szerk-cimke">Elfogadási kritériumok</label>
          <textarea
            className="szerk-mezo-kicsi"
            spellCheck={false}
            value={kriteriumok}
            onChange={(e) => setKriteriumok(e.target.value)}
          />
        </>
      )}

      <label className="szerk-cimke">Címkék (vesszővel)</label>
      <input className="mezo-be" value={cimkek} onChange={(e) => setCimkek(e.target.value)} />

      {utkozes ? (
        <div className="hiba-doboz" role="alert">
          <b>Mentési ütközés.</b> {(mentes.error as ApiHiba).message}{' '}
          A saját módosításaidat másold ki, mielőtt újratöltesz.{' '}
          <button className="gomb masodlagos" onClick={frissitEsBezar}>
            Legfrissebb változat betöltése
          </button>
        </div>
      ) : (
        mentes.isError && <Hiba uzenet={(mentes.error as ApiHiba).message} />
      )}
    </>
  );
}
