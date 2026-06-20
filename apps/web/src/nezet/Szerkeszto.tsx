import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
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
      },
      { onSuccess: onKesz },
    );
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

      {mentes.isError && <Hiba uzenet={(mentes.error as ApiHiba).message} />}
    </>
  );
}
