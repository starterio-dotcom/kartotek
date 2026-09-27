import { useMemo, useState } from 'react';
import { szabad } from '@kartotek/shared';
import { useMegjegyzes, useMegjegyzesMegoldas, useFelhasznalok } from '../api/hooks';
import { useAuth } from '../allapot/auth';
import { uzenet } from '../allapot/uzenetek';
import type { Elem, Verzio, Megjegyzes } from '../api/tipusok';

export function Velemenyezes({ elem, verzio }: { elem: Elem; verzio: Verzio }) {
  const { felhasznalo } = useAuth();
  const ujMegjegyzes = useMegjegyzes(elem.id, verzio.verzioSzam);
  const megoldas = useMegjegyzesMegoldas(elem.id, verzio.verzioSzam);
  const { data: felhasznalok } = useFelhasznalok();
  const nevMap = useMemo(() => {
    const m = new Map<string, string>();
    (felhasznalok ?? []).forEach((f) => m.set(f.id, f.nev));
    return m;
  }, [felhasznalok]);
  const nev = (id: string) => nevMap.get(id) ?? 'ismeretlen';
  const [szoveg, setSzoveg] = useState('');
  const [valaszMjid, setValasz] = useState<string | null>(null);
  const [valaszSzoveg, setValaszSzoveg] = useState('');

  // A backend ugyanezt kényszeríti: Olvasónak ne kínáljunk olyat, ami némán elbukna.
  const ctx = felhasznalo ? { felhasznalo, alkalmazasKod: elem.alkalmazasKod } : null;
  const irhat = !!ctx && szabad('megjegyzés.írás', ctx);
  const megoldhat = !!ctx && szabad('megjegyzés.megoldás', ctx);

  const gyokerek = verzio.megjegyzesek.filter((m) => !m.valaszMjid);
  const valaszok = (mjid: string) => verzio.megjegyzesek.filter((m) => m.valaszMjid === mjid);

  const kuld = (szov: string, valasz?: string) => {
    if (!szov.trim()) return;
    ujMegjegyzes.mutate(
      { szoveg: szov, ...(valasz ? { valaszMjid: valasz } : {}) },
      {
        onSuccess: () => {
          uzenet.siker(valasz ? 'Válasz elküldve.' : 'Megjegyzés elküldve — a másik fél értesítést kapott.');
          if (valasz) {
            setValasz(null);
            setValaszSzoveg('');
          } else setSzoveg('');
        },
      },
    );
  };
  const megold = (mjid: string) =>
    megoldas.mutate({ mjid }, { onSuccess: () => uzenet.siker('Megjegyzés megoldottra állítva.') });

  return (
    <div className="mj-lista">
      {gyokerek.length === 0 && (
        <div className="torzs"><span className="ures">Még nincs megjegyzés.</span></div>
      )}
      {gyokerek.map((m) => (
        <div key={m.mjid} className="mj-sor">
          <MegjegyzesSor m={m} szerzo={nev(m.szerzoId)} onMegold={megoldhat ? () => megold(m.mjid) : undefined} />
          {valaszok(m.mjid).map((r) => (
            <div key={r.mjid} className="mj-valasz">
              <MegjegyzesSor m={r} szerzo={nev(r.szerzoId)} onMegold={megoldhat ? () => megold(r.mjid) : undefined} />
            </div>
          ))}
          {irhat &&
            (valaszMjid === m.mjid ? (
              <div className="mj-uj">
                <textarea
                  className="mezo-be"
                  value={valaszSzoveg}
                  onChange={(e) => setValaszSzoveg(e.target.value)}
                  placeholder="Válasz…"
                  aria-label="Válasz"
                />
                <button
                  className="gomb elsodleges"
                  disabled={ujMegjegyzes.isPending || !valaszSzoveg.trim()}
                  onClick={() => kuld(valaszSzoveg, m.mjid)}
                >
                  {ujMegjegyzes.isPending ? 'Küldés…' : 'Küldés'}
                </button>
              </div>
            ) : (
              <button
                className="kapcs-link"
                style={{ fontSize: 12, marginTop: 4 }}
                onClick={() => setValasz(m.mjid)}
              >
                Válasz
              </button>
            ))}
        </div>
      ))}

      {irhat ? (
        <div className="mj-uj">
          <textarea
            className="mezo-be"
            value={szoveg}
            onChange={(e) => setSzoveg(e.target.value)}
            placeholder="Új megjegyzés…"
            aria-label="Új megjegyzés"
          />
          <button
            className="gomb elsodleges"
            disabled={ujMegjegyzes.isPending || !szoveg.trim()}
            onClick={() => kuld(szoveg)}
          >
            {ujMegjegyzes.isPending ? 'Küldés…' : 'Küldés'}
          </button>
        </div>
      ) : (
        <p className="mj-zar">Megjegyzést Szerző, Jóváhagyó vagy Admin szerepkörrel írhatsz.</p>
      )}
    </div>
  );
}

function MegjegyzesSor({ m, szerzo, onMegold }: { m: Megjegyzes; szerzo: string; onMegold?: () => void }) {
  return (
    <div className="mj-fej">
      <div>
        <div className="mj-szoveg">{m.szoveg}</div>
        <div className="mj-meta">
          <b style={{ color: 'var(--t-eros)' }}>{szerzo}</b> · {new Date(m.letrehozva).toLocaleString('hu-HU')}
        </div>
      </div>
      {m.allapot === 'nyitott' ? (
        onMegold ? (
          <button className="mj-megold" onClick={onMegold}>Megoldottra</button>
        ) : (
          <span className="mj-megoldva">nyitott</span>
        )
      ) : (
        <span className="mj-megoldva">megoldott</span>
      )}
    </div>
  );
}
