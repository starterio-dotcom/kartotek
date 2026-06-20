import { useState } from 'react';
import { szabad } from '@kartotek/shared';
import { useCimkekFrissites, useElemek } from '../api/hooks';
import type { Elem, Felhasznalo } from '../api/tipusok';

export function CimkeSzerk({ elem, felhasznalo }: { elem: Elem; felhasznalo: Felhasznalo }) {
  const [szerk, setSzerk] = useState(false);
  const [uj, setUj] = useState('');
  const frissites = useCimkekFrissites(elem.id);
  const { data: osszesElem } = useElemek({});

  const kezelheto = szabad('címke.kezelés', { felhasznalo, alkalmazasKod: elem.alkalmazasKod });
  const osszesCimke = [...new Set((osszesElem ?? []).flatMap((e) => e.cimkek))].sort();
  const javaslatok = osszesCimke.filter((t) => !elem.cimkek.includes(t)).slice(0, 14);

  const ment = (cimkek: string[]) => frissites.mutate(cimkek);
  const hozzaad = (t: string) => {
    const v = t.trim();
    if (v && !elem.cimkek.includes(v)) ment([...elem.cimkek, v]);
    setUj('');
  };

  if (!szerk) {
    return (
      <>
        <div className="blokk-cim cimke-szerk-fej">
          Címkék
          <span className="tolto" />
          {kezelheto && (
            <button className="cimke-szerk-gomb" onClick={() => setSzerk(true)}>
              Szerkesztés
            </button>
          )}
        </div>
        {elem.cimkek.length ? (
          elem.cimkek.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))
        ) : (
          <div className="torzs"><span className="ures">Nincs címke.</span></div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="blokk-cim cimke-szerk-fej">
        Címkék
        <span className="tolto" />
        <button className="cimke-szerk-gomb" onClick={() => setSzerk(false)}>
          Kész
        </button>
      </div>
      <div>
        {elem.cimkek.length ? (
          elem.cimkek.map((t, i) => (
            <span key={t} className="tag-chip-szerk">
              {t}
              <button
                className="tag-chip-x"
                title="Eltávolítás"
                onClick={() => ment(elem.cimkek.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </span>
          ))
        ) : (
          <span className="ures" style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--t-leges)' }}>
            Még nincs címke.
          </span>
        )}
      </div>
      <div className="cimke-uj-sor">
        <input
          value={uj}
          onChange={(e) => setUj(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hozzaad(uj)}
          placeholder="Új címke… (Enter)"
          aria-label="Új címke"
        />
        <button className="chip" onClick={() => hozzaad(uj)}>+</button>
      </div>
      {javaslatok.length > 0 && (
        <div className="cimke-keszlet">
          <span className="cimke-keszlet-cim">Közös készlet</span>
          {javaslatok.map((t) => (
            <button key={t} className="cimke-javaslat" onClick={() => hozzaad(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
