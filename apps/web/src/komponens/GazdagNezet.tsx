import { useMemo } from 'react';
import { generateHTML } from '@tiptap/html';
import type { JSONContent } from '@tiptap/core';
import { kiterjesztesek } from './tiptap-bovitmenyek';
import { Markdown, type MellekletKontextus } from './Markdown';
import { htmlAlairtSrc } from './melleklet-url';

/**
 * A részletes leírás read-only megjelenítése. Ha van gazdag (JSON) tartalom,
 * azt rendereljük; egyébként a régi/seed markdown a forrás.
 */
export function GazdagNezet({
  leiras,
  leirasMd,
  melleklet,
}: {
  leiras: unknown;
  leirasMd: string;
  melleklet?: MellekletKontextus;
}) {
  const html = useMemo(() => {
    if (!leiras || typeof leiras !== 'object') return null;
    try {
      const nyers = generateHTML(leiras as JSONContent, kiterjesztesek());
      // A beágyazott natív <img>/<video> nyers tartalom-útjait aláírt URL-re cseréljük.
      return melleklet ? htmlAlairtSrc(nyers, melleklet.mellekletek) : nyers;
    } catch {
      return null;
    }
  }, [leiras, melleklet]);

  if (html != null) return <div className="gazdag" dangerouslySetInnerHTML={{ __html: html }} />;
  return <Markdown szoveg={leirasMd} melleklet={melleklet} />;
}
