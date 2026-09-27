import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/kliens';
import { hibaSzoveg } from '../api/hibaSzoveg';
import { uzenet } from '../allapot/uzenetek';
import { Gomb, Hiba, Modal, Mezo } from '../komponens/ui';
import type { Elem, Felhasznalo } from '../api/tipusok';

/**
 * Jogi zárolás (legal hold) állapota a kartotékon: aktív zárolásnál figyelmeztető sáv
 * (ki, mikor, miért, és mi tiltott); globális Adminnak elrendelés/feloldás indoklással.
 */
export function JogiZarolasSav({ elem, felhasznalo }: { elem: Elem; felhasznalo: Felhasznalo }) {
  const qc = useQueryClient();
  const [nyitva, setNyitva] = useState(false);
  const [ok, setOk] = useState('');
  const aktiv = !!elem.jogiZarolas?.aktiv;
  const admin = felhasznalo.globalisAdmin;

  const valt = useMutation({
    meta: { helyiHiba: true },
    mutationFn: () => api.post<Elem>(`/api/elemek/${elem.id}/jogi-zarolas`, { aktiv: !aktiv, ok }),
    onSuccess: (uj) => {
      qc.setQueryData(['elem', elem.id], uj);
      setNyitva(false);
      setOk('');
      uzenet.siker(aktiv ? `Jogi zárolás feloldva: ${elem.kulcs}.` : `Jogi zárolás elrendelve: ${elem.kulcs}.`);
    },
  });

  if (!aktiv && !admin) return null;

  return (
    <>
      {aktiv ? (
        <div className="zarolas-sav" role="status">
          <span className="zarolas-jel" aria-hidden="true">⚖</span>
          <div className="zarolas-szoveg">
            <b>Jogi zárolás alatt</b> — {elem.jogiZarolas!.ok}
            <div className="zarolas-meta">
              {elem.jogiZarolas!.kiNev ?? 'ismeretlen'}
              {elem.jogiZarolas!.mikor ? `, ${new Date(elem.jogiZarolas!.mikor).toLocaleString('hu-HU')}` : ''}.
              A feloldásig tiltott: törlés, elvetés, archiválás, melléklet- és kapcsolattörlés.
            </div>
          </div>
          {admin && (
            <Gomb onClick={() => setNyitva(true)}>Zárolás feloldása</Gomb>
          )}
        </div>
      ) : (
        <div className="zarolas-admin">
          <button className="chip" onClick={() => setNyitva(true)} title="Vizsgálat, jogvita vagy hatósági megkeresés idejére">
            ⚖ Jogi zárolás elrendelése
          </button>
        </div>
      )}

      {nyitva && (
        <Modal cim={aktiv ? 'Jogi zárolás feloldása' : 'Jogi zárolás elrendelése'} onBezar={() => setNyitva(false)}>
          <p>
            {aktiv
              ? 'A feloldás után az elem ismét törölhető, elvethető, archiválható.'
              : 'A zárolás alatt az elem nem törölhető, nem vethető el és nem archiválható; mellékletei és kapcsolatai sem törölhetők. A tartalmi munka (szerkesztés, jóváhagyás) folytatódhat.'}
          </p>
          <Mezo cimke="Indoklás (kötelező, naplózzuk)">
            <textarea value={ok} onChange={(e) => setOk(e.target.value)} placeholder="pl. hatósági megkeresés száma" />
          </Mezo>
          {ok.trim().length > 0 && ok.trim().length < 5 && <p className="mezo-sugo">Legalább 5 karakter.</p>}
          {valt.isError && <Hiba uzenet={hibaSzoveg(valt.error)} />}
          <div className="modal-gombok">
            <Gomb onClick={() => setNyitva(false)}>Mégse</Gomb>
            <Gomb valtozat="elsodleges" disabled={ok.trim().length < 5 || valt.isPending} onClick={() => valt.mutate()}>
              {aktiv ? 'Feloldás' : 'Elrendelés'}
            </Gomb>
          </div>
        </Modal>
      )}
    </>
  );
}
