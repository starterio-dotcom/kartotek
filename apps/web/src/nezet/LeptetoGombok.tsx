import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/kliens';
import { hibaSzoveg } from '../api/hibaSzoveg';
import { uzenet } from '../allapot/uzenetek';
import type { Elem, Verzio, Felhasznalo } from '../api/tipusok';
import { elerhetoMuveletek, lepesSikerSzoveg, muveletHint, MUVELET_UI, type MuveletUi } from '../domain/verzio';
import { Gomb, Modal, Mezo, Hiba } from '../komponens/ui';

export function LeptetoGombok({
  elem,
  verzio,
  felhasznalo,
  onUjVerzio,
}: {
  elem: Elem;
  verzio: Verzio;
  felhasznalo: Felhasznalo;
  /** Új verzió nyitása után a nézet az új Vázlatra vált (különben észre sem venni). */
  onUjVerzio?: (verzioSzam: number) => void;
}) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<MuveletUi | null>(null);

  const leptet = useMutation({
    // A dialógusos lépések hibája a dialógusban látszik; az egykattintásosaké toastban (lent).
    meta: { helyiHiba: true },
    mutationFn: ({ akcio, body }: { akcio: string; body?: unknown }) =>
      api.post<Elem>(`/api/elemek/${elem.id}/verziok/${verzio.verzioSzam}/${akcio}`, body),
    onSuccess: (uj, { akcio }) => {
      qc.setQueryData(['elem', elem.id], uj);
      void qc.invalidateQueries({ queryKey: ['elemek'] });
      void qc.invalidateQueries({ queryKey: ['graf'] });
      // A törölhetőség a státusztól függ (csak csupa-Vázlat elem törölhető) — ne maradjon elavult.
      void qc.invalidateQueries({ queryKey: ['elem', elem.id, 'torolheto'] });
      setDialog(null);
      uzenet.siker(lepesSikerSzoveg(akcio, uj, verzio.verzioSzam));
      if (akcio === 'ujverzio') onUjVerzio?.(Math.max(...uj.verziok.map((v) => v.verzioSzam)));
    },
  });

  const elerheto = elerhetoMuveletek(elem, verzio, felhasznalo);
  const muveletek = elerheto.map((m) => MUVELET_UI[m]).filter((x): x is MuveletUi => !!x);
  const hint = muveletHint(elem, verzio, felhasznalo, elerheto);

  return (
    <>
      {hint && <span className="szerep-hint">{hint}</span>}
      {muveletek.map((m) => (
        <Gomb
          key={m.akcio}
          valtozat={m.valtozat}
          title={m.leiras}
          disabled={leptet.isPending}
          onClick={() =>
            m.dialog === 'nincs'
              ? leptet.mutate({ akcio: m.akcio }, { onError: (e) => uzenet.hiba(hibaSzoveg(e)) })
              : setDialog(m)
          }
        >
          {m.cimke}
        </Gomb>
      ))}

      {dialog && (
        <LeptetoDialog
          dialog={dialog}
          folyamatban={leptet.isPending}
          hiba={leptet.isError ? hibaSzoveg(leptet.error) : null}
          onMegse={() => {
            setDialog(null);
            leptet.reset();
          }}
          onKuld={(body) => leptet.mutate({ akcio: dialog.akcio, body })}
        />
      )}
    </>
  );
}

/** A mai nap HELYI idő szerint (a `toISOString` UTC-je éjfél után a tegnapot adná). */
const maStr = () => new Date().toLocaleDateString('sv-SE');

function LeptetoDialog({
  dialog,
  folyamatban,
  hiba,
  onMegse,
  onKuld,
}: {
  dialog: MuveletUi;
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
  const tipus = dialog.dialog;

  const kuld = () => {
    setHelyiHiba(null);
    if (tipus === 'jovahagyas') {
      if (!hatalyKezdet) return setHelyiHiba('A kezdődátum kötelező.');
      const veg = visszavonasig ? null : hatalyVeg;
      if (!visszavonasig && !veg) return setHelyiHiba('Adj meg végdátumot vagy jelöld a „visszavonásig” opciót.');
      if (veg && veg <= hatalyKezdet) return setHelyiHiba('A végdátumnak a kezdődátum után kell lennie.');
      return onKuld({ hatalyKezdet, hatalyVeg: veg });
    }
    if (tipus === 'visszadobas') {
      if (!indoklas.trim()) return setHelyiHiba('Az indoklás megadása kötelező.');
      return onKuld({ indoklas });
    }
    if (tipus === 'kivezetes') {
      if (!hatalyVeg) return setHelyiHiba('A végdátum kötelező.');
      return onKuld({ hatalyVeg });
    }
    if (tipus === 'megerosites') return onKuld(undefined);
    return onKuld({ indoklas: indoklas || undefined });
  };

  const felirat = dialog.megerosito ?? 'Megerősítés';

  return (
    <Modal cim={dialog.cimke.replace(/…$/, '')} onBezar={onMegse}>
      <p className="dialog-magyarazat">{dialog.leiras}</p>

      {tipus === 'jovahagyas' && (
        <>
          <Mezo cimke="Hatályosság kezdete">
            <input type="date" value={hatalyKezdet} onChange={(e) => setKezdet(e.target.value)} />
          </Mezo>
          <div className="jelolo">
            <input
              id="lepteto-visszavonasig"
              type="checkbox"
              checked={visszavonasig}
              onChange={(e) => setVisszavonasig(e.target.checked)}
            />
            <label htmlFor="lepteto-visszavonasig">Visszavonásig hatályos (nincs végdátum)</label>
          </div>
          {!visszavonasig && (
            <Mezo cimke="Hatályosság vége">
              <input type="date" min={hatalyKezdet || undefined} value={hatalyVeg} onChange={(e) => setVeg(e.target.value)} />
            </Mezo>
          )}
        </>
      )}

      {tipus === 'kivezetes' && (
        <Mezo cimke="Hatályosság vége">
          <input type="date" min={maStr()} value={hatalyVeg} onChange={(e) => setVeg(e.target.value)} />
        </Mezo>
      )}

      {(tipus === 'visszadobas' || tipus === 'elvetes') && (
        <Mezo cimke={tipus === 'visszadobas' ? 'Indoklás (kötelező)' : 'Indoklás (opcionális)'}>
          <textarea value={indoklas} onChange={(e) => setIndoklas(e.target.value)} />
        </Mezo>
      )}

      {(helyiHiba || hiba) && <Hiba uzenet={helyiHiba ?? hiba!} />}

      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onMegse}>Mégse</button>
        <button className={`btn${dialog.valtozat === 'veszelyes' ? ' veszelyes' : ''}`} disabled={folyamatban} onClick={kuld}>
          {folyamatban ? `${felirat}…` : felirat}
        </button>
      </div>
    </Modal>
  );
}
