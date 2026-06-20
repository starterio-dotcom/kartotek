import { describe, it, expect } from 'vitest';
import { elerhetoCsomopontok, hatasElemzes, lefedetlenBus } from './bejaras';
import { torolhetoE } from './torles';

describe('elerhetoCsomopontok', () => {
  const elek = [
    { forras: 'a', cel: 'b' },
    { forras: 'b', cel: 'c' },
    { forras: 'a', cel: 'd' },
  ];

  it('a mélység szerinti elérhetőséget adja, a start nélkül', () => {
    const r = elerhetoCsomopontok('a', elek);
    expect(r.get('b')).toBe(1);
    expect(r.get('c')).toBe(2);
    expect(r.get('d')).toBe(1);
    expect(r.has('a')).toBe(false);
  });

  it('kör esetén sem fut végtelen ciklusba', () => {
    const korben = [
      { forras: 'x', cel: 'y' },
      { forras: 'y', cel: 'x' },
    ];
    const r = elerhetoCsomopontok('x', korben);
    expect(r.get('y')).toBe(1);
    expect(r.has('x')).toBe(false);
  });
});

describe('hatasElemzes', () => {
  // b → c → d (lebontja-lánc), b a középső.
  const elek = [
    { forras: 'b', cel: 'c' },
    { forras: 'c', cel: 'd' },
    { forras: 'a', cel: 'b' },
  ];

  it('lefelé és felfelé is bejár', () => {
    const h = hatasElemzes('b', elek);
    expect(h.lefele.map((x) => x.id)).toEqual(['c', 'd']);
    expect(h.felfele.map((x) => x.id)).toEqual(['a']);
  });

  it('a mélység szerint rendezett', () => {
    const h = hatasElemzes('b', elek);
    expect(h.lefele).toEqual([
      { id: 'c', melyseg: 1 },
      { id: 'd', melyseg: 2 },
    ]);
  });
});

describe('lefedetlenBus', () => {
  it('a TUS nélküli BUS-okat adja vissza', () => {
    const csomopontok = [
      { id: 'bus1', tipusKod: 'BUS' as const },
      { id: 'bus2', tipusKod: 'BUS' as const },
      { id: 'f1', tipusKod: 'F' as const },
      { id: 'tus1', tipusKod: 'TUS' as const },
    ];
    // bus1 → f1 → tus1 (fedett); bus2 magában (fedetlen)
    const lebontja = [
      { forras: 'bus1', cel: 'f1' },
      { forras: 'f1', cel: 'tus1' },
    ];
    expect(lefedetlenBus(csomopontok, lebontja)).toEqual(['bus2']);
  });

  it('a közvetlen TUS-gyerek is lefedettnek számít', () => {
    const csomopontok = [
      { id: 'bus1', tipusKod: 'BUS' as const },
      { id: 'tus1', tipusKod: 'TUS' as const },
    ];
    expect(lefedetlenBus(csomopontok, [{ forras: 'bus1', cel: 'tus1' }])).toEqual([]);
  });
});

describe('torolhetoE', () => {
  it('sosem hivatkozott Vázlat törölhető', () => {
    const d = torolhetoE({
      verziok: [{ statusz: 'Vázlat' }],
      bejovoKapcsolatok: 0,
      kimenoKapcsolatok: 0,
    });
    expect(d.torolheto).toBe(true);
    expect(d.ajanlott).toBeNull();
  });

  it('Hatályos verziójú elem nem törölhető, archiválást ajánl', () => {
    const d = torolhetoE({
      verziok: [{ statusz: 'Hatályos' }],
      bejovoKapcsolatok: 0,
      kimenoKapcsolatok: 0,
    });
    expect(d.torolheto).toBe(false);
    expect(d.ajanlott).toBe('archiválás');
    expect(d.okok.some((o) => o.includes('auditnyom'))).toBe(true);
  });

  it('hivatkozott Vázlat nem törölhető, elvetést ajánl', () => {
    const d = torolhetoE({
      verziok: [{ statusz: 'Vázlat' }],
      bejovoKapcsolatok: 2,
      kimenoKapcsolatok: 0,
    });
    expect(d.torolheto).toBe(false);
    expect(d.ajanlott).toBe('elvetés');
    expect(d.okok[0]).toContain('2 másik elem');
  });

  it('kimenő kapcsolat is megakadályozza a törlést', () => {
    const d = torolhetoE({
      verziok: [{ statusz: 'Vázlat' }],
      bejovoKapcsolatok: 0,
      kimenoKapcsolatok: 1,
    });
    expect(d.torolheto).toBe(false);
    expect(d.okok.some((o) => o.includes('kimenő'))).toBe(true);
  });
});
