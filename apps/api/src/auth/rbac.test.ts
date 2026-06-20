import { describe, it, expect } from 'vitest';
import { szerkesztoIds } from './rbac.js';

describe('szerkesztoIds (négy-szem-elv)', () => {
  it('egyesíti a módosítót, MINDEN szerkesztőt és a napló nem-RENDSZER szereplőit', () => {
    const ids = szerkesztoIds({
      verzioSzam: 1,
      statusz: 'Véleményezés',
      modositottaId: 'cili',
      szerkesztok: ['bela', 'cili'],
      statusznaplo: [{ ki: 'anna' }, { ki: 'RENDSZER' }],
    });
    expect(new Set(ids)).toEqual(new Set(['cili', 'bela', 'anna']));
    expect(ids).not.toContain('RENDSZER');
  });

  it('egy korábbi szerkesztő (nem a legutóbbi módosító) is bekerül — nem kijátszható', () => {
    const ids = szerkesztoIds({
      verzioSzam: 1,
      statusz: 'Vázlat',
      modositottaId: 'cili', // a legutóbbi módosító
      szerkesztok: ['bela', 'cili'], // de Béla is szerkesztett korábban
      statusznaplo: [],
    });
    expect(ids).toContain('bela');
  });
});
