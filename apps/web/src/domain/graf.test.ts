import { describe, it, expect } from 'vitest';
import { elrendez, kornyezet, szintje, SZABALYZAT_SZINT, EL_STILUS, type Graf } from './graf';

const graf: Graf = {
  csomopontok: [
    { id: 'b', kulcs: '3R-BUS-002', tipusKod: 'BUS', retegKod: null, alkalmazasKod: '3R', statusz: 'Hatályos' },
    { id: 't', kulcs: '3R-TUC-001', tipusKod: 'TUC', retegKod: null, alkalmazasKod: '3R', statusz: 'Jóváhagyott' },
    { id: 's', kulcs: '3R-Core-TUS-003', tipusKod: 'TUS', retegKod: 'Core', alkalmazasKod: '3R', statusz: 'Véleményezés' },
  ],
  szabalyzatok: ['IB-XYT-14-1213'],
  elek: [
    { id: 'e1', forras: 'b', cel: 't', fajta: 'lebontja' },
    { id: 'e2', forras: 't', cel: 's', fajta: 'lebontja' },
    { id: 'e3', forras: 's', cel: 'sz:IB-XYT-14-1213', fajta: 'megfelel' },
  ],
};

describe('szintje', () => {
  it('a típuskódokat a hierarchia szintjeire képezi', () => {
    expect(szintje('BUS')).toBe(0);
    expect(szintje('TUC')).toBe(1);
    expect(szintje('TUS')).toBe(2);
    expect(szintje('BD')).toBe(3);
  });
});

describe('elrendez', () => {
  it('a szabályzatot a 4. szintre, az elemeket a típusuk szerint helyezi', () => {
    const { csomopontok } = elrendez(graf);
    const sz = csomopontok.find((c) => c.id === 'sz:IB-XYT-14-1213')!;
    expect(sz.szint).toBe(SZABALYZAT_SZINT);
    expect(csomopontok.find((c) => c.id === 'b')!.szint).toBe(0);
    expect(csomopontok.find((c) => c.id === 's')!.szint).toBe(2);
  });

  it('a mélyebb szintű csomópontok lejjebb (nagyobb y) vannak', () => {
    const { csomopontok } = elrendez(graf);
    const b = csomopontok.find((c) => c.id === 'b')!;
    const s = csomopontok.find((c) => c.id === 's')!;
    expect(s.y).toBeGreaterThan(b.y);
  });

  it('minden csomóponthoz tartozik pozíció', () => {
    const { csomopontok, szelesseg, magassag } = elrendez(graf);
    expect(csomopontok).toHaveLength(4); // 3 elem + 1 szabályzat
    expect(szelesseg).toBeGreaterThan(0);
    expect(magassag).toBeGreaterThan(0);
  });
});

describe('kornyezet', () => {
  it('a kijelölt csomópont közvetlen szomszédságát adja', () => {
    const k = kornyezet(graf.elek, 't'); // t szomszédai: b és s
    expect(k).toEqual(new Set(['t', 'b', 's']));
    expect(k.has('sz:IB-XYT-14-1213')).toBe(false);
  });
});

describe('EL_STILUS', () => {
  it('minden kapcsolatfajtához van stílus', () => {
    expect(EL_STILUS.lebontja.szin).toBe('#4258ED');
    expect(EL_STILUS.leváltja.vastagsag).toBeGreaterThan(2);
    expect(EL_STILUS['függ tőle'].dash).not.toBe('');
  });
});
