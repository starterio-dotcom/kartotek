import { describe, it, expect } from 'vitest';
import { verzioSzerzoIds } from './szerzok.js';
import { szabad } from './szabad.js';

const naplo = (honnan: string | null, hova: string, ki: string) => ({ honnan, hova, ki });

describe('verzioSzerzoIds (négy-szem-elv + értesítés)', () => {
  it('egyesíti a módosítót, minden szerkesztőt, a létrehozót és a beküldőt', () => {
    const ids = verzioSzerzoIds({
      modositottaId: 'cili',
      szerkesztok: ['bela', 'cili'],
      statusznaplo: [naplo(null, 'Vázlat', 'anna'), naplo('Vázlat', 'Véleményezés', 'dora')],
    });
    expect(new Set(ids)).toEqual(new Set(['cili', 'bela', 'anna', 'dora']));
  });

  it('a visszadobó és a jóváhagyó bíráló NEM szerző; a RENDSZER sem', () => {
    const ids = verzioSzerzoIds({
      modositottaId: 'anna',
      statusznaplo: [
        naplo(null, 'Vázlat', 'anna'),
        naplo('Vázlat', 'Véleményezés', 'anna'),
        naplo('Véleményezés', 'Vázlat', 'julia'), // visszadobás
        naplo('Vázlat', 'Véleményezés', 'anna'),
        naplo('Véleményezés', 'Jóváhagyott', 'peter'),
        naplo('Jóváhagyott', 'Hatályos', 'RENDSZER'),
      ],
    });
    expect(ids).toEqual(['anna']);
  });

  it('a hiányzó mezőket és a null azonosítót elviseli', () => {
    expect(verzioSzerzoIds({})).toEqual([]);
    expect(verzioSzerzoIds({ modositottaId: null, szerkesztok: [null, undefined] })).toEqual([]);
  });

  it('regresszió: visszadobás és újraküldés után ugyanaz a Jóváhagyó jóváhagyhat', () => {
    const verzio = {
      modositottaId: 'anna',
      statusznaplo: [
        naplo(null, 'Vázlat', 'anna'),
        naplo('Vázlat', 'Véleményezés', 'anna'),
        naplo('Véleményezés', 'Vázlat', 'julia'),
        naplo('Vázlat', 'Véleményezés', 'anna'),
      ],
    };
    const julia = { id: 'julia', globalisAdmin: false, tagsagok: [{ alkalmazasKod: '3R', szerepkor: 'Jóváhagyó' as const }] };
    const ctx = { felhasznalo: julia, alkalmazasKod: '3R', verzio: { statusz: 'Véleményezés' as const, szerkesztoIds: verzioSzerzoIds(verzio) } };
    expect(szabad('verzió.jóváhagyás', ctx)).toBe(true);
    // …a szerző továbbra sem hagyhatja jóvá a sajátját.
    const anna = { id: 'anna', globalisAdmin: true, tagsagok: [] };
    expect(szabad('verzió.jóváhagyás', { ...ctx, felhasznalo: anna })).toBe(false);
  });
});
