import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });

/** Mermaid-diagram render; hibánál/parsehibánál a forráskódra esik vissza. */
export function Mermaid({ kod }: { kod: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [hiba, setHiba] = useState(false);
  const id = 'mm' + useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let elo = true;
    mermaid
      .render(id, kod)
      .then((r) => elo && setSvg(r.svg))
      .catch(() => elo && setHiba(true));
    return () => {
      elo = false;
    };
  }, [id, kod]);

  if (hiba) return <pre className="md-kod" data-nyelv="mermaid">{kod}</pre>;
  if (!svg) return <div className="md-mermaid"><pre className="mermaid">{kod}</pre></div>;
  return <div className="md-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}
