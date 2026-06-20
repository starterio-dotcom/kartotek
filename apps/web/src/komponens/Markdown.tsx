import type { ReactElement } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Melleklet } from '../api/tipusok';
import { MellekletKep } from './MellekletNezo';
import { Mermaid } from './Mermaid';

export interface MellekletKontextus {
  elemId: string;
  verzioSzam: number;
  mellekletek: Melleklet[];
}

/**
 * Markdown-render GFM-mel. A `melleklet:ID` képhivatkozásokat a verzió tényleges
 * mellékletéből oldja fel (kép/Figma-pillanatkép beágyazás); kontextus nélkül,
 * vagy hiányzó mellékletnél jelöléssel mutatja. (Mermaid render: Fázis 5.)
 */
export function Markdown({
  szoveg,
  melleklet,
}: {
  szoveg: string;
  melleklet?: MellekletKontextus;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => (url.startsWith('melleklet:') ? url : defaultUrlTransform(url))}
      components={{
        img: ({ src, alt }) => {
          if (typeof src === 'string' && src.startsWith('melleklet:')) {
            const mid = src.slice('melleklet:'.length);
            const m = melleklet?.mellekletek.find((x) => x.mid === mid);
            if (melleklet && m && (m.tipus === 'kep' || m.tipus === 'figma')) {
              return (
                <span className="mell-kep">
                  <MellekletKep
                    elemId={melleklet.elemId}
                    v={melleklet.verzioSzam}
                    mid={m.mid}
                    alt={alt || m.alt}
                  />
                </span>
              );
            }
            return (
              <span className="tag-chip">📎 melléklet: {alt || (m?.alt ?? mid)}</span>
            );
          }
          return <img src={src} alt={alt ?? ''} style={{ maxWidth: '100%', borderRadius: 'var(--r-m)' }} />;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        table: ({ children }) => <table className="md-tabla">{children}</table>,
        pre: ({ children }) => {
          // A `pre` gyermeke a `code` elem — kódnyelv + tartalom kinyerése.
          const code = children as ReactElement<{ className?: string; children?: unknown }>;
          const cls = code?.props?.className ?? '';
          const nyelv = /language-(\w+)/.exec(cls)?.[1];
          const tartalom = String(code?.props?.children ?? '');
          if (nyelv === 'mermaid') return <Mermaid kod={tartalom.trim()} />;
          return (
            <pre className="md-kod" data-nyelv={nyelv}>
              {children}
            </pre>
          );
        },
      }}
    >
      {szoveg}
    </ReactMarkdown>
  );
}
