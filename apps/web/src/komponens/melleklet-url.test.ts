import { describe, it, expect } from 'vitest';
import { htmlAlairtSrc, jsonAlairtSrc, jsonNyersSrc } from './melleklet-url';
import type { Melleklet } from '../api/tipusok';

const nyersUt = '/api/elemek/E1/verziok/1/mellekletek/m_kep/tartalom';
const alairt = `${nyersUt}?exp=9999&sig=abc`;

const mellekletek: Melleklet[] = [
  { mid: 'm_kep', tipus: 'kep', alt: 'Kép', tartalomHiv: 'lemez:x', vanTartalom: true, tartalomUrl: alairt },
];

describe('htmlAlairtSrc', () => {
  it('a nyers tartalom-utat aláírt URL-re cseréli', () => {
    const html = `<p><img src="${nyersUt}" alt="Kép"></p>`;
    expect(htmlAlairtSrc(html, mellekletek)).toContain(`src="${alairt}"`);
  });

  it('ismeretlen mid-et változatlanul hagy', () => {
    const html = '<img src="/api/elemek/E1/verziok/1/mellekletek/m_nincs/tartalom">';
    expect(htmlAlairtSrc(html, mellekletek)).toBe(html);
  });
});

describe('jsonAlairtSrc / jsonNyersSrc', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'image', attrs: { src: nyersUt } },
      { type: 'video', attrs: { src: nyersUt, cim: 'v' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
    ],
  };

  it('betöltéskor aláírt URL-re cserél', () => {
    const alairtDoc = jsonAlairtSrc(doc, mellekletek);
    expect(alairtDoc.content![0]!.attrs!.src).toBe(alairt);
    expect(alairtDoc.content![1]!.attrs!.src).toBe(alairt);
  });

  it('mentéskor visszaír nyers útra (query nélkül)', () => {
    const alairtDoc = jsonAlairtSrc(doc, mellekletek);
    const nyers = jsonNyersSrc(alairtDoc);
    expect(nyers.content![0]!.attrs!.src).toBe(nyersUt);
    expect(nyers.content![1]!.attrs!.src).toBe(nyersUt);
  });

  it('oda-vissza körút megőrzi az eredetit', () => {
    expect(jsonNyersSrc(jsonAlairtSrc(doc, mellekletek))).toEqual(doc);
  });
});
