import { describe, it, expect } from 'vitest';
import { STATUSZOK, szabad } from '@kartotek/shared';

describe('shared a frontenden', () => {
  it('a domain-mag importálható és működik', () => {
    expect(STATUSZOK).toContain('Hatályos');
    expect(
      szabad('elem.olvasás', {
        felhasznalo: {
          id: 'u1',
          globalisAdmin: false,
          tagsagok: [{ alkalmazasKod: '3R', szerepkor: 'Olvasó' }],
        },
        alkalmazasKod: '3R',
      }),
    ).toBe(true);
  });
});
