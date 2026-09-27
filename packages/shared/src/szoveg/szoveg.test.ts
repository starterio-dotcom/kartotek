import { describe, it, expect } from 'vitest';
import { tiptapSzoveg, verzioKeresoSzoveg } from './index.js';

const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Regisztráció' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A vendég ' },
        { type: 'text', text: 'e-mailben', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' kap visszaigazolást.' },
      ],
    },
    { type: 'image', attrs: { src: '/api/x', alt: 'Űrlap vázlat' } },
  ],
};

describe('tiptapSzoveg', () => {
  it('a szövegcsomópontokat összefűzi, blokkok között sortöréssel', () => {
    const s = tiptapSzoveg(doc);
    expect(s).toContain('Regisztráció\n');
    expect(s).toContain('A vendég e-mailben kap visszaigazolást.');
  });

  it('a beágyazott kép alt-szövege is kereshető', () => {
    expect(tiptapSzoveg(doc)).toContain('Űrlap vázlat');
  });

  it('érvénytelen bemenetre üres szöveg', () => {
    expect(tiptapSzoveg(null)).toBe('');
    expect(tiptapSzoveg('nem objektum')).toBe('');
  });
});

describe('verzioKeresoSzoveg', () => {
  it('a gazdag leírást használja, ha van, és hozzáveszi a típusmezőket', () => {
    const s = verzioKeresoSzoveg({
      leiras: doc,
      leirasMd: 'RÉGI markdown',
      tipusMezok: { rovid: 'Rövid összefoglaló', kriteriumok: 'Elfogadási feltétel' },
    });
    expect(s).toContain('visszaigazolást');
    expect(s).toContain('Rövid összefoglaló');
    expect(s).toContain('Elfogadási feltétel');
    expect(s).not.toContain('RÉGI markdown'); // a gazdag tartalom az irányadó
  });

  it('gazdag tartalom nélkül a markdown a forrás', () => {
    expect(verzioKeresoSzoveg({ leirasMd: 'Papíralapú regisztráció' })).toBe('Papíralapú regisztráció');
  });
});
