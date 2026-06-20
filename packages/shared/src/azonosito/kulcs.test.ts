import { describe, it, expect } from 'vitest';
import { formazKulcs, elemezKulcs, validalKulcsReszek, ervenyesKulcs } from './kulcs';

describe('azonosító — formázás', () => {
  it('üzleti elem réteg nélkül, nullával töltött sorszám', () => {
    expect(formazKulcs({ alkKod: '3R', retegKod: null, tipusKod: 'BUS', sorszam: 2 })).toBe(
      '3R-BUS-002',
    );
  });

  it('technikai elem réteggel', () => {
    expect(formazKulcs({ alkKod: '3R', retegKod: 'FE', tipusKod: 'TUS', sorszam: 2 })).toBe(
      '3R-FE-TUS-002',
    );
    expect(formazKulcs({ alkKod: 'Terminus', retegKod: 'TDB', tipusKod: 'TD', sorszam: 1 })).toBe(
      'Terminus-TDB-TD-001',
    );
  });

  it('üzleti elemhez megadott réteg hibát dob', () => {
    expect(() => formazKulcs({ alkKod: '3R', retegKod: 'FE', tipusKod: 'BUS', sorszam: 1 })).toThrow();
  });

  it('technikai elemhez hiányzó réteg hibát dob', () => {
    expect(() => formazKulcs({ alkKod: '3R', retegKod: null, tipusKod: 'TUS', sorszam: 1 })).toThrow();
  });
});

describe('azonosító — elemzés', () => {
  it('üzleti kulcs elemzése', () => {
    expect(elemezKulcs('3R-BUS-002')).toEqual({
      alkKod: '3R',
      retegKod: null,
      tipusKod: 'BUS',
      sorszam: 2,
    });
  });

  it('technikai kulcs elemzése', () => {
    expect(elemezKulcs('3R-Core-TUS-003')).toEqual({
      alkKod: '3R',
      retegKod: 'Core',
      tipusKod: 'TUS',
      sorszam: 3,
    });
    expect(elemezKulcs('Terminus-TDB-TD-001')).toEqual({
      alkKod: 'Terminus',
      retegKod: 'TDB',
      tipusKod: 'TD',
      sorszam: 1,
    });
  });

  it('oda-vissza (formáz ∘ elemez) megőrzi az értéket', () => {
    for (const kulcs of ['3R-BUS-002', '3R-FE-TUS-002', 'Terminus-TDB-TD-001']) {
      const r = elemezKulcs(kulcs);
      expect(r).not.toBeNull();
      expect(formazKulcs(r!)).toBe(kulcs);
    }
  });

  it('érvénytelen alak → null', () => {
    expect(elemezKulcs('')).toBeNull();
    expect(elemezKulcs('3R-BUS')).toBeNull(); // nincs sorszám
    expect(elemezKulcs('3R-XXX-002')).toBeNull(); // ismeretlen típus
    expect(elemezKulcs('3R-FE-TUS-abc')).toBeNull(); // nem szám a sorszám
    expect(elemezKulcs('3R-ZZ-TUS-002')).toBeNull(); // ismeretlen réteg
    expect(elemezKulcs('3R-TUS-002')).toBeNull(); // technikai, de hiányzik a réteg
  });
});

describe('azonosító — validálás', () => {
  it('helyes részek → nincs hiba', () => {
    expect(validalKulcsReszek({ alkKod: '3R', retegKod: 'FE', tipusKod: 'TUS', sorszam: 1 })).toEqual(
      [],
    );
  });

  it('nem pozitív sorszám hibát ad', () => {
    expect(
      validalKulcsReszek({ alkKod: '3R', retegKod: null, tipusKod: 'BUS', sorszam: 0 }).length,
    ).toBeGreaterThan(0);
  });

  it('ervenyesKulcs() teljes kört ellenőriz', () => {
    expect(ervenyesKulcs('3R-FE-TUS-002')).toBe(true);
    expect(ervenyesKulcs('3R-TUS-002')).toBe(false);
  });
});
