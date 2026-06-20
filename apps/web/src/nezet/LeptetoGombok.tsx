import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiHiba } from '../api/kliens';
import type { Elem, Verzio, Felhasznalo } from '../api/tipusok';
import { elerhetoMuveletek, MUVELET_UI, type DialogTipus } from '../domain/verzio';
import { Gomb, Modal, Mezo, Hiba } from '../komponens/ui';

interface DialogAllapot {
  tipus: DialogTipus;
  akcio: string;
  cimke: string;
}

export function LeptetoGombok({
  elem,
  verzio,
  felhasznalo,
}: {
  elem: Elem;
  verzio: Verzio;
  felhasznalo: Felhasznalo;
}) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogAllapot | null>(null);

  const leptet = useMutation({
    mutationFn: ({ akcio, body }: { akcio: string; body?: unknown }) =>
      api.post<Elem>(`/api/elemek/${elem.id}/verziok/${verzio.verzioSzam}/${akcio}`, body),
    onSuccess: (uj) => {
      qc.setQueryData(['elem', elem.id], uj);
      void qc.invalidateQueries({ queryKey: ['elemek'] });
      void qc.invalidateQueries({ queryKey: ['graf'] });
      setDialog(null);
    },
  });

  const muveletek = elerhetoMuveletek(elem, verzio, felhasznalo)
    .map((m) => MUVELET_UI[m])
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (muveletek.length === 0)
    return <span className="szerep-hint">Innen az ütemező léptet tovább, dátum alapján.</span>;

  return (
    <>
      {muveletek.map((m) => (
        <Gomb
          key={m.akcio}
          valtozat={m.valtozat}
          disabled={leptet.isPending}
          onClick={() =>
            m.dialog === 'nincs'
              ? leptet.mutate({ akcio: m.akcio })
              : setDialog({ tipus: m.dialog, akcio: m.akcio, cimke: m.cimke })
          }
        >
          {m.cimke}
        </Gomb>
      ))}

      {dialog && (
        <LeptetoDialog
          dialog={dialog}
          folyamatban={leptet.isPending}
          hiba={leptet.isError ? (leptet.error as ApiHiba).message : null}
          onMegse={() => setDialog(null)}
          onKuld={(body) => leptet.mutate({ akcio: dialog.akcio, body })}
        />
      )}
    </>
  );
}

const maStr = () => new Date().toISOString().slice(0, 10);

function LeptetoDialog({
  dialog,
  folyamatban,
  hiba,
  onMegse,
  onKuld,
}: {
  dialog: DialogAllapot;
  folyamatban: boolean;
  hiba: string | null;
  onMegse: () => void;
  onKuld: (body: unknown) => void;
}) {
  const [hatalyKezdet, setKezdet] = useState(maStr());
  const [visszavonasig, setVisszavonasig] = useState(true);
  const [hatalyVeg, setVeg] = useState('');
  const [indoklas, setIndoklas] = useState('');
  const [helyiHiba, setHelyiHiba] = useState<string | null>(null);

  const kuld = () => {
    setHelyiHiba(null);
    if (dialog.tipus === 'jovahagyas') {
      if (!hatalyKezdet) return setHelyiHiba('A kezdődátum kötelező.');
      const veg = visszavonasig ? null : hatalyVeg;
      if (!visszavonasig && !veg) return setHelyiHiba('Adj meg végdátumot vagy jelöld a „visszavonásig” opciót.');
      if (veg && veg <= hatalyKezdet) return setHelyiHiba('A végdátumnak a kezdődátum után kell lennie.');
      return onKuld({ hatalyKezdet, hatalyVeg: veg });
    }
    if (dialog.tipus === 'visszadobas') {
      if (!indoklas.trim()) return setHelyiHiba('Az indoklás megadása kötelező.');
      return onKuld({ indoklas });
    }
    if (dialog.tipus === 'kivezetes') {
      if (!hatalyVeg) return setHelyiHiba('A végdátum kötelező.');
      return onKuld({ hatalyVeg });
    }
    return onKuld({ indoklas: indoklas || undefined });
  };

  return (
    <Modal cim={dialog.cimke} onBezar={onMegse}>
      {dialog.tipus === 'jovahagyas' && (
        <>
          <Mezo cimke="Hatályosság kezdete">
            <input type="date" value={hatalyKezdet} onChange={(e) => setKezdet(e.target.value)} />
          </Mezo>
          <div className="jelolo">
            <input type="checkbox" checked={visszavonasig} onChange={(e) => setVisszavonasig(e.target.checked)} />
            <span>Visszavonásig hatályos (nincs végdátum)</span>
          </div>
          {!visszavonasig && (
            <Mezo cimke="Hatályosság vége">
              <input type="date" value={hatalyVeg} onChange={(e) => setVeg(e.target.value)} />
            </Mezo>
          )}
        </>
      )}

      {dialog.tipus === 'kivezetes' && (
        <Mezo cimke="Hatályosság vége">
          <input type="date" value={hatalyVeg} onChange={(e) => setVeg(e.target.value)} />
        </Mezo>
      )}

      {(dialog.tipus === 'visszadobas' || dialog.tipus === 'elvetes') && (
        <Mezo cimke={dialog.tipus === 'visszadobas' ? 'Indoklás (kötelező)' : 'Indoklás (opcionális)'}>
          <textarea value={indoklas} onChange={(e) => setIndoklas(e.target.value)} />
        </Mezo>
      )}

      {(helyiHiba || hiba) && <Hiba uzenet={helyiHiba ?? hiba!} />}

      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onMegse}>Mégse</button>
        <button className="btn" disabled={folyamatban} onClick={kuld}>Megerősítés</button>
      </div>
    </Modal>
  );
}
