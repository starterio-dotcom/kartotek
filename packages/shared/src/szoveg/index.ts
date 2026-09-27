/**
 * Szöveg-kinyerés a verzió tartalmából — tiszta függvények (a FE diffje és a
 * BE kereső-mezője egyaránt ezt használja).
 */

const BLOKK_TIPUSOK = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'tableCell', 'tableHeader']);

/** Sima szöveg kinyerése TipTap/ProseMirror JSON-ból (blokkok között sortörés). */
export function tiptapSzoveg(doc: unknown): string {
  const out: string[] = [];
  const bejar = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    const o = n as { text?: unknown; type?: string; content?: unknown[]; attrs?: Record<string, unknown> };
    if (typeof o.text === 'string') out.push(o.text);
    // Beágyazott média feliratai (kép alt, Figma cím) is kereshetők legyenek.
    if (o.attrs && (o.type === 'image' || o.type === 'figma' || o.type === 'video')) {
      for (const k of ['alt', 'title', 'cim']) {
        const v = o.attrs[k];
        if (typeof v === 'string' && v.trim()) out.push(` ${v} `);
      }
    }
    if (Array.isArray(o.content)) {
      o.content.forEach(bejar);
      if (o.type && BLOKK_TIPUSOK.has(o.type)) out.push('\n');
    }
  };
  bejar(doc);
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export interface KeresoVerzio {
  leiras?: unknown;
  leirasMd?: string | null;
  tipusMezok?: unknown;
}

/**
 * A verzió teljes kereshető szövege: a részletes leírás (gazdag tartalom, vagy ha
 * nincs, a markdown), plusz a rövid leírás, az előfeltételek és a kritériumok.
 * A cím és a kulcs külön, nagyobb súllyal indexelt mező — itt nem szerepel.
 */
export function verzioKeresoSzoveg(v: KeresoVerzio): string {
  const tm = (v.tipusMezok && typeof v.tipusMezok === 'object' ? v.tipusMezok : {}) as Record<string, unknown>;
  const leiras = v.leiras && typeof v.leiras === 'object' ? tiptapSzoveg(v.leiras) : (v.leirasMd ?? '');
  return [leiras, tm.rovid, tm.elofeltetelek, tm.kriteriumok]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join('\n')
    .trim();
}
