import { describe, it, expect } from 'vitest';
import { elerhetoMuveletek, szerkesztoIds, vanUjabbAktivVerzio } from './verzio';
import type { Elem, Verzio, Felhasznalo } from '../api/tipusok';
import type { Statusz, Szerepkor } from '@kartotek/shared';

function verzio(p: Partial<Verzio> & { statusz: Statusz }): Verzio {
  return {
    verzioSzam: 1,
    cim: 'Cím',
    leirasMd: '',
    tipusMezok: {},
    hatalyKezdet: null,
    hatalyVeg: null,
    letrehozva: '2026-01-01',
    modositottaId: 'u1',
    statusznaplo: [{ hova: 'Vázlat', mikor: '2026-01-01', ki: 'u1' }],
    mellekletek: [],
    megjegyzesek: [],
    ...p,
  };
}

function elem(v: Verzio[]): Elem {
  return {
    id: 'e1',
    kulcs: '3R-BUS-009',
    tipusKod: 'BUS',
    alkalmazasKod: '3R',
    retegKod: null,
    cimkek: [],
    verziok: v,
  };
}

function felh(id: string, szerepkor: Szerepkor, globalisAdmin = false): Felhasznalo {
  return {
    id,
    nev: id,
    email: `${id}@x.hu`,
    globalisAdmin,
    tagsagok: [{ alkalmazasKod: '3R', szerepkor }],
  };
}

describe('szerkesztoIds', () => {
  it('a módosítót és a napló nem-RENDSZER szereplőit gyűjti', () => {
    const v = verzio({
      statusz: 'Hatályos',
      modositottaId: 'u1',
      statusznaplo: [
        { hova: 'Vázlat', mikor: '', ki: 'u1' },
        { honnan: 'Jóváhagyott', hova: 'Hatályos', mikor: '', ki: 'RENDSZER' },
      ],
    });
    expect(szerkesztoIds(v).sort()).toEqual(['u1']);
  });
});

describe('vanUjabbAktivVerzio', () => {
  it('igaz, ha van újabb nem-végállapotú verzió', () => {
    const e = elem([verzio({ statusz: 'Hatályos', verzioSzam: 1 }), verzio({ statusz: 'Vázlat', verzioSzam: 2 })]);
    expect(vanUjabbAktivVerzio(e, 1)).toBe(true);
  });
  it('hamis, ha az újabb verzió végállapotú', () => {
    const e = elem([verzio({ statusz: 'Hatályos', verzioSzam: 1 }), verzio({ statusz: 'Elvetve', verzioSzam: 2 })]);
    expect(vanUjabbAktivVerzio(e, 1)).toBe(false);
  });
});

describe('elerhetoMuveletek — szerep + státusz szerinti gombok', () => {
  it('Vázlat + Szerző → beküldés és elvetés', () => {
    const v = verzio({ statusz: 'Vázlat', modositottaId: 'u1' });
    const m = elerhetoMuveletek(elem([v]), v, felh('u1', 'Szerző'));
    expect(m).toContain('verzió.beküldés');
    expect(m).toContain('verzió.elvetés');
    expect(m).not.toContain('verzió.jóváhagyás');
  });

  it('Véleményezés + Jóváhagyó (nem szerző) → jóváhagyás és visszadobás', () => {
    const v = verzio({ statusz: 'Véleményezés', modositottaId: 'u1' });
    const m = elerhetoMuveletek(elem([v]), v, felh('u2', 'Jóváhagyó'));
    expect(m).toContain('verzió.jóváhagyás');
    expect(m).toContain('verzió.visszadobás');
  });

  it('négy-szem-elv: a szerző (akár Jóváhagyó) nem hagyhatja jóvá a sajátját', () => {
    const v = verzio({ statusz: 'Véleményezés', modositottaId: 'u1' });
    const m = elerhetoMuveletek(elem([v]), v, felh('u1', 'Jóváhagyó'));
    expect(m).not.toContain('verzió.jóváhagyás');
  });

  it('Olvasó nem kap életciklus-gombot', () => {
    const v = verzio({ statusz: 'Vázlat' });
    const m = elerhetoMuveletek(elem([v]), v, felh('u3', 'Olvasó'));
    expect(m).toHaveLength(0);
  });
});
