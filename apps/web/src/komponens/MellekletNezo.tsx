import { useEffect, useState } from 'react';
import { tartalomFetch } from '../api/kliens';

function tartalomUtvonal(elemId: string, v: number, mid: string): string {
  return `/api/elemek/${elemId}/verziok/${v}/mellekletek/${mid}/tartalom`;
}

/** Egy melléklet bájtjainak betöltése blob-URL-ként (a dev-fejléccel).
 *  `enabled: false` esetén nem indul kérés — azonnal hibaállapot (placeholder). */
function useBlobUrl(
  utvonal: string,
  enabled = true,
): { url: string | null; betolt: boolean; hiba: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [betolt, setBetolt] = useState(enabled);
  const [hiba, setHiba] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setBetolt(false);
      setHiba(true);
      return;
    }
    let elo = true;
    let keszUrl: string | null = null;
    setBetolt(true);
    setHiba(false);
    tartalomFetch(utvonal)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (!elo) return;
        keszUrl = URL.createObjectURL(blob);
        setUrl(keszUrl);
      })
      .catch(() => elo && setHiba(true))
      .finally(() => elo && setBetolt(false));
    return () => {
      elo = false;
      if (keszUrl) URL.revokeObjectURL(keszUrl);
    };
  }, [utvonal, enabled]);

  return { url, betolt, hiba };
}

export function MellekletKep({
  elemId,
  v,
  mid,
  alt,
  className = '',
  vanTartalom,
}: {
  elemId: string;
  v: number;
  mid: string;
  alt: string;
  className?: string;
  /** Ha az API szerint nincs tárolt tartalom, meg sem próbáljuk letölteni. */
  vanTartalom?: boolean;
}) {
  const { url, betolt, hiba } = useBlobUrl(tartalomUtvonal(elemId, v, mid), vanTartalom !== false);
  if (betolt) return <span className="mell-meta">kép betöltése…</span>;
  if (hiba || !url)
    return <span className="tag-chip">📎 {alt} (a fájl nem elérhető)</span>;
  return <img src={url} alt={alt} className={className} />;
}

export function csvParse(szoveg: string): string[][] {
  return szoveg
    .trim()
    .split(/\r?\n/)
    .map((sor) => sor.split(','));
}

export function CsvElonezet({
  elemId,
  v,
  mid,
  vanTartalom,
}: {
  elemId: string;
  v: number;
  mid: string;
  vanTartalom?: boolean;
}) {
  const [sorok, setSorok] = useState<string[][] | null>(null);
  const [hiba, setHiba] = useState(vanTartalom === false);

  useEffect(() => {
    if (vanTartalom === false) {
      setHiba(true);
      return;
    }
    let elo = true;
    tartalomFetch(tartalomUtvonal(elemId, v, mid))
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const szoveg = await res.text();
        if (elo) setSorok(csvParse(szoveg));
      })
      .catch(() => elo && setHiba(true));
    return () => {
      elo = false;
    };
  }, [elemId, v, mid, vanTartalom]);

  if (hiba) return <span className="mell-meta">A CSV nem elérhető.</span>;
  if (!sorok) return <span className="mell-meta">CSV betöltése…</span>;
  const [fej, ...adat] = sorok;

  return (
    <table className="md-tabla mell-csv">
      <thead>
        <tr>{fej?.map((c, i) => <th key={i}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {adat.map((sor, i) => (
          <tr key={i}>{sor.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
