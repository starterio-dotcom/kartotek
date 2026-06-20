import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { szabad } from '@kartotek/shared';
import { api, feltoltFajl, ApiHiba } from '../api/kliens';
import { useAuth } from '../allapot/auth';
import { Hiba } from '../komponens/ui';
import { MellekletKep, CsvElonezet } from '../komponens/MellekletNezo';
import type { Elem, Verzio, Melleklet } from '../api/tipusok';

export function Mellekletek({ elem, verzio }: { elem: Elem; verzio: Verzio }) {
  const { felhasznalo } = useAuth();
  const qc = useQueryClient();
  const fajlRef = useRef<HTMLInputElement>(null);
  const [figmaLink, setFigmaLink] = useState('');

  const kezelheto =
    verzio.statusz === 'Vázlat' &&
    !!felhasznalo &&
    szabad('melléklet.kezelés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });

  const utvonal = `/api/elemek/${elem.id}/verziok/${verzio.verzioSzam}/mellekletek`;
  const frissit = () => void qc.invalidateQueries({ queryKey: ['elem', elem.id] });

  const feltoltes = useMutation({
    mutationFn: (file: File) => feltoltFajl<Elem>(utvonal, file),
    onSuccess: frissit,
  });
  const figmaFelvetel = useMutation({
    mutationFn: () => api.post<Elem>(`${utvonal}/figma`, { alt: 'Figma terv', figmaLink }),
    onSuccess: () => {
      setFigmaLink('');
      frissit();
    },
  });
  const torles = useMutation({
    mutationFn: (mid: string) => api.del<Elem>(`${utvonal}/${mid}`),
    onSuccess: frissit,
  });

  const hibaUzenet =
    (feltoltes.error as ApiHiba)?.message ??
    (figmaFelvetel.error as ApiHiba)?.message ??
    (torles.error as ApiHiba)?.message;

  return (
    <>
      {verzio.mellekletek.length === 0 && (
        <div className="torzs"><span className="ures">Nincs melléklet.</span></div>
      )}

      {verzio.mellekletek.map((m) => (
        <div className="mell-sor" key={m.mid}>
          <MellBelyeg elemId={elem.id} v={verzio.verzioSzam} m={m} />
          <div className="mell-sor-szoveg">
            <b>{m.alt}</b>
            <div className="mell-meta">
              {m.tipus}
              {m.tipus === 'figma' && !m.figmaPng ? ' · csak élő link' : ''}
            </div>
            {m.tipus === 'csv' && <CsvElonezet elemId={elem.id} v={verzio.verzioSzam} mid={m.mid} />}
          </div>
          {m.figmaLink && (
            <a className="mell-link" href={m.figmaLink} target="_blank" rel="noreferrer" title="Megnyitás Figmában">
              ↗
            </a>
          )}
          {kezelheto && (
            <button className="kapcs-torol" title="Törlés" disabled={torles.isPending} onClick={() => torles.mutate(m.mid)}>
              ✕
            </button>
          )}
        </div>
      ))}

      {hibaUzenet && <Hiba uzenet={hibaUzenet} />}

      {kezelheto ? (
        <>
          <div className="mell-gombsor">
            <label className="chip mell-feltolt">
              + Fájl (kép / CSV)
              <input
                ref={fajlRef}
                type="file"
                hidden
                accept="image/*,.csv,text/csv"
                onChange={() => {
                  const f = fajlRef.current?.files?.[0];
                  if (f) feltoltes.mutate(f);
                }}
              />
            </label>
          </div>
          <div className="mell-gombsor">
            <input
              className="mezo-be"
              style={{ flex: 1 }}
              placeholder="Figma élő link (…node-id=297%3A4125)"
              value={figmaLink}
              onChange={(e) => setFigmaLink(e.target.value)}
              aria-label="Figma link"
            />
            <button className="chip" disabled={!figmaLink || figmaFelvetel.isPending} onClick={() => figmaFelvetel.mutate()}>
              + Figma
            </button>
          </div>
        </>
      ) : (
        <div className="mell-zar">A mellékletek a verzióhoz fagyasztva — csak Vázlatban módosíthatók.</div>
      )}
    </>
  );
}

function MellBelyeg({ elemId, v, m }: { elemId: string; v: number; m: Melleklet }) {
  if (m.tipus === 'csv') return <span className="mell-ikon">⠿</span>;
  if (m.tipus === 'figma' && !m.figmaPng) return <span className="mell-ikon mell-ikon-figma">F</span>;
  return (
    <span className="mell-belyeg">
      <MellekletKep elemId={elemId} v={v} mid={m.mid} alt={m.alt} />
    </span>
  );
}
