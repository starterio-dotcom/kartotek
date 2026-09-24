import type { JSONContent } from '@tiptap/core';
import type { Melleklet } from '../api/tipusok';

/**
 * A beágyazott natív média (<img>/<video>, Figma-pillanatkép) `src`-je a tárolt
 * tartalomban a NYERS relatív tartalom-út (query nélkül). A megjelenítéskor ezt
 * a mid alapján az aláírt tartalom-URL-re cseréljük, hogy auth-fejléc nélkül is
 * betöltsön; mentéskor visszaírjuk nyersre, hogy a tárolt tartalom kanonikus
 * (lejárat-mentes) maradjon.
 */

/** A tartalom-út mintázata a mid kinyeréséhez (query-vel vagy anélkül). */
const TARTALOM_RE = /\/api\/elemek\/[^"'\s?]+?\/mellekletek\/([^"'\s?/]+)\/tartalom/g;

/** mid → aláírt tartalom-URL leképezés az elem melléklet-listájából. */
function urlMap(mellekletek: Melleklet[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of mellekletek) if (x.tartalomUrl) m.set(x.mid, x.tartalomUrl);
  return m;
}

/** A generált HTML nyers tartalom-útjait aláírt URL-ekre cseréli (read-only nézet). */
export function htmlAlairtSrc(html: string, mellekletek: Melleklet[]): string {
  const map = urlMap(mellekletek);
  return html.replace(TARTALOM_RE, (teljes, mid: string) => map.get(mid) ?? teljes);
}

/** Egy src/png attribútum aláírt URL-je (vagy az eredeti, ha nincs találat). */
function cserel(ertek: unknown, map: Map<string, string>): unknown {
  if (typeof ertek !== 'string') return ertek;
  const talalat = TARTALOM_RE.exec(ertek);
  TARTALOM_RE.lastIndex = 0; // a globális regex állapotának visszaállítása
  if (!talalat) return ertek;
  return map.get(talalat[1]!) ?? ertek;
}

/** Egy src/png attribútumból a query levágása → nyers tartalom-út. */
function nyersre(ertek: unknown): unknown {
  if (typeof ertek !== 'string') return ertek;
  return ertek.replace(/(\/mellekletek\/[^"'\s?/]+\/tartalom)\?[^"'\s]*$/, '$1');
}

function bejar(node: JSONContent, atalakit: (attrs: Record<string, unknown>) => void): JSONContent {
  const uj: JSONContent = { ...node };
  if (uj.attrs) {
    const attrs = { ...uj.attrs };
    atalakit(attrs);
    uj.attrs = attrs;
  }
  if (Array.isArray(uj.content)) uj.content = uj.content.map((gy) => bejar(gy, atalakit));
  return uj;
}

/** A TipTap JSON média-src-jeit aláírt URL-ekre cseréli (a szerkesztő betöltésekor). */
export function jsonAlairtSrc(doc: JSONContent, mellekletek: Melleklet[]): JSONContent {
  const map = urlMap(mellekletek);
  return bejar(doc, (attrs) => {
    if ('src' in attrs) attrs.src = cserel(attrs.src, map);
    if ('png' in attrs) attrs.png = cserel(attrs.png, map);
  });
}

/** A TipTap JSON média-src-jeit visszaírja nyers útra (a szerkesztő mentésekor). */
export function jsonNyersSrc(doc: JSONContent): JSONContent {
  return bejar(doc, (attrs) => {
    if ('src' in attrs) attrs.src = nyersre(attrs.src);
    if ('png' in attrs) attrs.png = nyersre(attrs.png);
  });
}
