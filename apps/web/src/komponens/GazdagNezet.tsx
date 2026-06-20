import { useMemo } from 'react';
import { generateHTML } from '@tiptap/html';
import type { JSONContent } from '@tiptap/core';
import { kiterjesztesek } from './tiptap-bovitmenyek';
import { Markdown, type MellekletKontextus } from './Markdown';

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
      return generateHTML(leiras as JSONContent, kiterjesztesek());
    } catch {
      return null;
    }
  }, [leiras]);

  if (html != null) return <div className="gazdag" dangerouslySetInnerHTML={{ __html: html }} />;
  return <Markdown szoveg={leirasMd} melleklet={melleklet} />;
}
