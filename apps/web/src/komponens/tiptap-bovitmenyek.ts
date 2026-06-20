import { Node, mergeAttributes, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

/** Beágyazott videó (atomi blokk-csomópont, natív <video>). */
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, cim: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'video[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, { controls: 'true', class: 'mell-video-be' }),
    ];
  },
});

/** Figma-keret beágyazás: élő link + opcionális pillanatkép (kártya). */
export const Figma = Node.create({
  name: 'figma',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { link: { default: '' }, png: { default: null }, alt: { default: 'Figma terv' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-figma]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const { link, png, alt } = HTMLAttributes as { link: string; png: string | null; alt: string };
    const fej = [
      'div',
      { class: 'mell-figma-fej' },
      ['span', { class: 'figma-jel' }, 'F'],
      ['a', { href: link, target: '_blank', rel: 'noreferrer' }, alt || 'Figma terv'],
    ];
    const test = png
      ? ['img', { src: png, alt }]
      : ['div', { class: 'mell-figma-hely' }, 'Élő Figma terv (pillanatkép nélkül) — kattints a megnyitáshoz'];
    return ['div', { 'data-figma': '', 'data-link': link, class: 'mell-figma' }, fej, test];
  },
});

/** A gazdag tartalom kiterjesztései — a szerkesztő és a read-only render is ezt használja. */
export function kiterjesztesek(): Extensions {
  return [
    StarterKit,
    Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noreferrer', target: '_blank' } }),
    Image,
    Table.configure({ resizable: false }),
    TableRow,
    TableCell,
    TableHeader,
    Video,
    Figma,
  ];
}
