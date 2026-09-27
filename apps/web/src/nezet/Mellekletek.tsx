import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { szabad, jogiZarolasTiltja } from '@kartotek/shared';
import { api, feltoltFajl } from '../api/kliens';
import { hibaSzoveg } from '../api/hibaSzoveg';
import { useAuth } from '../allapot/auth';
import { uzenet } from '../allapot/uzenetek';
import { Megerosites } from '../komponens/ui';
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

  // Zárolás alatt a feltöltés mehet (tartalmi munka), a törlés nem.
  const torolheto = kezelheto && !jogiZarolasTiltja('melléklet.törlés', elem.jogiZarolas);

  const utvonal = `/api/elemek/${elem.id}/verziok/${verzio.verzioSzam}/mellekletek`;
  const frissit = () => void qc.invalidateQueries({ queryKey: ['elem', elem.id] });

  const [torlendo, setTorlendo] = useState<Melleklet | null>(null);

  // A hibákat a központi toast mutatja (MutationCache) — itt csak a sikert jelezzük.
  const feltoltes = useMutation({
    mutationFn: (file: File) => feltoltFajl<Elem>(utvonal, file),
    onSuccess: (_e, file) => {
      frissit();
      uzenet.siker(`Feltöltve: ${file.name}`);
    },
  });
  const figmaFelvetel = useMutation({
    mutationFn: () => api.post<Elem>(`${utvonal}/figma`, { alt: 'Figma terv', figmaLink }),
    onSuccess: () => {
      setFigmaLink('');
      frissit();
      uzenet.siker('Figma-terv hozzáadva a mellékletekhez.');
    },
  });
  const torles = useMutation({
    meta: { helyiHiba: true },
    mutationFn: (mid: string) => api.del<Elem>(`${utvonal}/${mid}`),
    onSuccess: () => {
      frissit();
      uzenet.siker(`Melléklet törölve: ${torlendo?.alt ?? ''}`.trim());
      setTorlendo(null);
    },
  });

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
            {m.tipus === 'csv' && (
              <CsvElonezet elemId={elem.id} v={verzio.verzioSzam} mid={m.mid} vanTartalom={m.vanTartalom} />
            )}
          </div>
          {m.figmaLink && (
            <a className="mell-link" href={m.figmaLink} target="_blank" rel="noreferrer" title="Megnyitás Figmában">
              ↗
            </a>
          )}
          {torolheto && (
            <button
              className="kapcs-torol"
              title="Törlés"
              aria-label={`${m.alt} melléklet törlése`}
              disabled={torles.isPending}
              onClick={() => setTorlendo(m)}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {kezelheto ? (
        <>
          <div className="mell-gombsor">
            {/* Valódi gomb (billentyűzettel is elérhető) nyitja a rejtett fájlválasztót. */}
            <button
              type="button"
              className="chip mell-feltolt"
              disabled={feltoltes.isPending}
              onClick={() => fajlRef.current?.click()}
            >
              {feltoltes.isPending ? 'Feltöltés…' : '+ Fájl (kép / CSV)'}
            </button>
            <input
              ref={fajlRef}
              type="file"
              hidden
              accept="image/*,.csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) feltoltes.mutate(f);
                e.target.value = ''; // ugyanaz a fájl újra kiválasztható legyen
              }}
            />
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

      {torlendo && (
        <Megerosites
          cim="Melléklet törlése"
          gombFelirat="Törlés"
          veszelyes
          folyamatban={torles.isPending}
          hiba={torles.isError ? hibaSzoveg(torles.error) : null}
          onMegse={() => {
            setTorlendo(null);
            torles.reset();
          }}
          onMegerosit={() => torles.mutate(torlendo.mid)}
        >
          <p>
            Törlöd a(z) <b>„{torlendo.alt}”</b> mellékletet a {elem.kulcs} v{verzio.verzioSzam} verzióból? A fájl
            véglegesen törlődik, ez nem vonható vissza.
          </p>
          <p>Ha a részletes leírás hivatkozik rá, ott helyőrző jelenik meg.</p>
        </Megerosites>
      )}
    </>
  );
}

function MellBelyeg({ elemId, v, m }: { elemId: string; v: number; m: Melleklet }) {
  if (m.tipus === 'csv') return <span className="mell-ikon">⠿</span>;
  if (m.tipus === 'figma' && !m.figmaPng) return <span className="mell-ikon mell-ikon-figma">F</span>;
  return (
    <span className="mell-belyeg">
      <MellekletKep elemId={elemId} v={v} mid={m.mid} alt={m.alt} vanTartalom={m.vanTartalom} />
    </span>
  );
}
