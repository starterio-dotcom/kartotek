import { useRef } from 'react';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import { Markdown as MarkdownKiterj } from 'tiptap-markdown';
import { useQueryClient } from '@tanstack/react-query';
import { feltoltFajl } from '../api/kliens';
import { kiterjesztesek } from './tiptap-bovitmenyek';
import type { Elem } from '../api/tipusok';

function tartalomUrl(elemId: string, v: number, mid: string): string {
  return `/api/elemek/${elemId}/verziok/${v}/mellekletek/${mid}/tartalom`;
}

/**
 * Gazdag (TipTap, JSON) szerkesztő a részletes leíráshoz: formázás, tábla, link,
 * és inline kép/videó-feltöltés + Figma-beágyazás. A médiafájlok a verzió
 * mellékletei közé kerülnek, a beágyazás relatív tartalom-URL-re mutat.
 */
export function GazdagSzerkeszto({
  elemId,
  verzioSzam,
  ertek,
  leirasMd,
  onChange,
}: {
  elemId: string;
  verzioSzam: number;
  ertek: unknown;
  leirasMd: string;
  onChange: (json: JSONContent) => void;
}) {
  const qc = useQueryClient();
  const kepRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [...kiterjesztesek(), MarkdownKiterj.configure({ html: false })],
    content: (ertek as JSONContent) ?? leirasMd ?? '',
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) return null;
  const c = () => editor.chain().focus();

  const feltolt = async (file: File): Promise<string | null> => {
    const elem = await feltoltFajl<Elem>(`/api/elemek/${elemId}/verziok/${verzioSzam}/mellekletek`, file);
    void qc.invalidateQueries({ queryKey: ['elem', elemId] });
    const v = elem.verziok.find((x) => x.verzioSzam === verzioSzam);
    const mid = v?.mellekletek.at(-1)?.mid;
    return mid ? tartalomUrl(elemId, verzioSzam, mid) : null;
  };

  const kepFeltolt = async (file: File) => {
    const src = await feltolt(file);
    if (src) c().setImage({ src }).run();
  };
  const videoFeltolt = async (file: File) => {
    const src = await feltolt(file);
    if (src) c().insertContent({ type: 'video', attrs: { src } }).run();
  };
  const figmaBeszur = () => {
    const link = window.prompt('Figma élő link (node-id URL-kódolt kettősponttal):');
    if (link) c().insertContent({ type: 'figma', attrs: { link, alt: 'Figma terv' } }).run();
  };
  const linkBeszur = () => {
    const url = window.prompt('Hivatkozás URL-je:');
    if (url) c().setLink({ href: url }).run();
    else c().unsetLink().run();
  };

  const g = (cimke: React.ReactNode, aktiv: boolean, cim: string, hat: () => void) => (
    <button type="button" className={aktiv ? 'aktiv' : ''} title={cim} onMouseDown={(e) => e.preventDefault()} onClick={hat}>
      {cimke}
    </button>
  );

  return (
    <div className="wysiwyg-keret">
      <div className="wysiwyg-eszkoz">
        {g(<b>B</b>, editor.isActive('bold'), 'Félkövér', () => c().toggleBold().run())}
        {g(<i>I</i>, editor.isActive('italic'), 'Dőlt', () => c().toggleItalic().run())}
        <span className="valaszto" />
        {g('H1', editor.isActive('heading', { level: 1 }), 'Címsor 1', () => c().toggleHeading({ level: 1 }).run())}
        {g('H2', editor.isActive('heading', { level: 2 }), 'Címsor 2', () => c().toggleHeading({ level: 2 }).run())}
        {g('H3', editor.isActive('heading', { level: 3 }), 'Címsor 3', () => c().toggleHeading({ level: 3 }).run())}
        <span className="valaszto" />
        {g('• Lista', editor.isActive('bulletList'), 'Felsorolás', () => c().toggleBulletList().run())}
        {g('1. Lista', editor.isActive('orderedList'), 'Számozott', () => c().toggleOrderedList().run())}
        {g('❝', editor.isActive('blockquote'), 'Idézet', () => c().toggleBlockquote().run())}
        {g('⊞ Tábla', false, 'Táblázat', () => c().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run())}
        {g('</>', editor.isActive('codeBlock'), 'Kódblokk', () => c().toggleCodeBlock().run())}
        <span className="valaszto" />
        {g('🔗 Link', editor.isActive('link'), 'Hivatkozás', linkBeszur)}
        {g('🖼 Kép', false, 'Kép feltöltése és beszúrása', () => kepRef.current?.click())}
        {g('▶ Videó', false, 'Videó feltöltése és beszúrása', () => videoRef.current?.click())}
        {g('F Figma', false, 'Figma-terv beágyazása', figmaBeszur)}
      </div>
      <div className="wysiwyg">
        <EditorContent editor={editor} />
      </div>
      <div className="wysiwyg-jel">
        Gazdag szerkesztő — a tartalom strukturált (JSON) formában mentődik. A beszúrt kép/videó a verzió
        mellékletei közé kerül.
      </div>

      <input
        ref={kepRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void kepFeltolt(f);
          e.target.value = '';
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void videoFeltolt(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export type { Editor };
