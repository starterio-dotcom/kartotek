import { describe, it, expect } from 'vitest';
import { lebontasFa, type FaCsomopont } from './fa.js';

const c = (id: string, tipusKod: FaCsomopont['tipusKod'] = 'TUS'): FaCsomopont => ({
  id,
  kulcs: id,
  tipusKod,
});

describe('lebontasFa', () => {
  it('mélységi sorrend, BUS elöl, kulcs szerint', () => {
    const fa = lebontasFa(
      [c('B-TUS', 'TUS'), c('A-BUS', 'BUS'), c('C-TUC', 'TUC'), c('D-TD', 'TD')],
      [
        { forras: 'A-BUS', cel: 'C-TUC' },
        { forras: 'C-TUC', cel: 'B-TUS' },
      ],
    );
    expect(fa.gyokerek).toEqual(['A-BUS', 'D-TD']);
    expect(fa.sorrend.map((s) => `${s.id}@${s.melyseg}`)).toEqual([
      'A-BUS@0',
      'C-TUC@1',
      'B-TUS@2',
      'D-TD@0',
    ]);
  });

  it('több szülős elem egyszer, az első szülő alatt; az összes szülő rögzítve', () => {
    const fa = lebontasFa(
      [c('A', 'BUS'), c('B', 'BUS'), c('X')],
      [
        { forras: 'A', cel: 'X' },
        { forras: 'B', cel: 'X' },
      ],
    );
    expect(fa.sorrend.filter((s) => s.id === 'X')).toHaveLength(1);
    expect(fa.gyerekek.get('A')).toEqual(['X']);
    expect(fa.gyerekek.get('B')).toBeUndefined();
    expect(fa.szulok.get('X')).toEqual(['A', 'B']);
  });

  it('a halmazon kívülre mutató élt figyelmen kívül hagyja', () => {
    const fa = lebontasFa([c('A', 'BUS')], [{ forras: 'A', cel: 'KINT' }]);
    expect(fa.gyokerek).toEqual(['A']);
    expect(fa.gyerekek.size).toBe(0);
  });

  it('ciklus esetén sem esik végtelen ciklusba, minden elem szerepel', () => {
    const fa = lebontasFa(
      [c('A'), c('B')],
      [
        { forras: 'A', cel: 'B' },
        { forras: 'B', cel: 'A' },
      ],
    );
    expect(fa.sorrend.map((s) => s.id).sort()).toEqual(['A', 'B']);
  });
});
