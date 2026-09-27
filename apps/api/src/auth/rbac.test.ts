import { describe, it, expect } from 'vitest';
import { szerkesztoIds } from './rbac.js';

describe('szerkesztoIds (négy-szem-elv)', () => {
  it('egyesíti a módosítót, MINDEN szerkesztőt, a létrehozót és a beküldőt — a RENDSZER-t nem', () => {
    const ids = szerkesztoIds({
      verzioSzam: 1,
      statusz: 'Véleményezés',
      modositottaId: 'cili',
      szerkesztok: ['bela', 'cili'],
      statusznaplo: [
        { hova: 'Vázlat', ki: 'anna' },
        { honnan: 'Vázlat', hova: 'Véleményezés', ki: 'anna' },
        { honnan: 'Jóváhagyott', hova: 'Hatályos', ki: 'RENDSZER' },
      ],
    });
    expect(new Set(ids)).toEqual(new Set(['cili', 'bela', 'anna']));
    expect(ids).not.toContain('RENDSZER');
  });

  it('a visszadobó bíráló NEM szerző (különben az újraküldés után nem hagyhatná jóvá)', () => {
    const ids = szerkesztoIds({
      verzioSzam: 1,
      statusz: 'Véleményezés',
      modositottaId: 'anna',
      statusznaplo: [
        { hova: 'Vázlat', ki: 'anna' },
        { honnan: 'Vázlat', hova: 'Véleményezés', ki: 'anna' },
        { honnan: 'Véleményezés', hova: 'Vázlat', ki: 'julia' },
        { honnan: 'Vázlat', hova: 'Véleményezés', ki: 'anna' },
      ],
    });
    expect(ids).toEqual(['anna']);
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
