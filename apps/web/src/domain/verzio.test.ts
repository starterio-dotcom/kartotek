import { describe, it, expect } from 'vitest';
import {
  alapVerzio,
  elerhetoMuveletek,
  lepesSikerSzoveg,
  muveletHint,
  MUVELET_UI,
  szerkesztoIds,
  vanUjabbAktivVerzio,
  verzioKontextus,
} from './verzio';
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

  it('regresszió: a visszadobó Jóváhagyó az újraküldés után jóváhagyhat', () => {
    const v = verzio({
      statusz: 'Véleményezés',
      modositottaId: 'u1',
      statusznaplo: [
        { hova: 'Vázlat', mikor: '', ki: 'u1' },
        { honnan: 'Vázlat', hova: 'Véleményezés', mikor: '', ki: 'u1' },
        { honnan: 'Véleményezés', hova: 'Vázlat', mikor: '', ki: 'u2' },
        { honnan: 'Vázlat', hova: 'Véleményezés', mikor: '', ki: 'u1' },
      ],
    });
    expect(elerhetoMuveletek(elem([v]), v, felh('u2', 'Jóváhagyó'))).toContain('verzió.jóváhagyás');
  });
});

describe('muveletHint — miért nincs (több) gomb', () => {
  const hint = (v: Verzio, f: Felhasznalo, e = elem([v])) => muveletHint(e, v, f, elerhetoMuveletek(e, v, f));

  it('négy-szem-elv: a saját verzióját jóváhagyni akaró Jóváhagyó magyarázatot kap', () => {
    const v = verzio({ statusz: 'Véleményezés', modositottaId: 'u1' });
    expect(hint(v, felh('u1', 'Jóváhagyó'))).toMatch(/négy-szem-elv/);
  });

  it('Olvasó: szerepkör-magyarázat, nem a félrevezető „ütemező" szöveg', () => {
    expect(hint(verzio({ statusz: 'Vázlat' }), felh('u3', 'Olvasó'))).toMatch(/Olvasóként/);
  });

  it('végállapot és ütemezett átmenet nevén nevezve', () => {
    expect(hint(verzio({ statusz: 'Archivált' }), felh('u1', 'Szerző'))).toMatch(/végállapot/);
    expect(hint(verzio({ statusz: 'Jóváhagyott', hatalyKezdet: '2030-01-01' }), felh('u9', 'Jóváhagyó'))).toMatch(/ütemező Hatályossá/);
  });

  it('a szerző a beküldött verzión: a jóváhagyóra vár', () => {
    expect(hint(verzio({ statusz: 'Véleményezés', modositottaId: 'u1' }), felh('u1', 'Szerző'))).toMatch(/jóváhagyó dönt/);
  });

  it('ha a gombok önmagukért beszélnek, nincs hint', () => {
    expect(hint(verzio({ statusz: 'Vázlat', modositottaId: 'u1' }), felh('u1', 'Szerző'))).toBeNull();
  });
});

describe('alapVerzio + verzioKontextus — melyik verzió látszik, és mit mondunk a többiről', () => {
  const e = elem([verzio({ statusz: 'Hatályos', verzioSzam: 1 }), verzio({ statusz: 'Vázlat', verzioSzam: 2 })]);

  it('az Olvasó alapból a hatályos verziót látja, a Szerző a legújabbat', () => {
    expect(alapVerzio(e, felh('u3', 'Olvasó')).verzioSzam).toBe(1);
    expect(alapVerzio(e, felh('u1', 'Szerző')).verzioSzam).toBe(2);
    expect(alapVerzio(e, felh('u9', 'Olvasó', true)).verzioSzam).toBe(2); // globális Admin
  });

  it('hatály nélküli elemnél az Olvasó is a legújabbat látja', () => {
    const csakVazlat = elem([verzio({ statusz: 'Vázlat', verzioSzam: 1 })]);
    expect(alapVerzio(csakVazlat, felh('u3', 'Olvasó')).verzioSzam).toBe(1);
  });

  it('a hatályos nézetben jelzi a készülő újabbat; a vázlatnál a hatályosat', () => {
    expect(verzioKontextus(e, e.verziok[0]!)).toMatchObject({ cel: 2 });
    expect(verzioKontextus(e, e.verziok[0]!)!.szoveg).toMatch(/Készül egy újabb változat: v2/);
    expect(verzioKontextus(e, e.verziok[1]!)).toMatchObject({ cel: 1 });
    expect(verzioKontextus(e, e.verziok[1]!)!.szoveg).toMatch(/még nem hatályos/);
  });

  it('egyetlen verziónál nincs mit mondani', () => {
    const egy = elem([verzio({ statusz: 'Hatályos', verzioSzam: 1 })]);
    expect(verzioKontextus(egy, egy.verziok[0]!)).toBeNull();
  });
});

describe('életciklus-felület — megerősítés és visszajelzés', () => {
  it('az Archiválás visszafordíthatatlan → megerősítő dialógus, veszélyes gomb', () => {
    const a = MUVELET_UI['verzió.archiválás']!;
    expect(a.dialog).not.toBe('nincs');
    expect(a.valtozat).toBe('veszelyes');
    expect(a.megerosito).toBe('Archiválás');
  });

  it('a sikerüzenet kulcsot és verziót tartalmaz; új verziónál az új számot', () => {
    const e = elem([verzio({ statusz: 'Hatályos', verzioSzam: 1 }), verzio({ statusz: 'Vázlat', verzioSzam: 2 })]);
    expect(lepesSikerSzoveg('bekuldes', e, 2)).toMatch(/^3R-BUS-009 v2 beküldve/);
    expect(lepesSikerSzoveg('ujverzio', e, 1)).toBe('Új verzió nyitva: 3R-BUS-009 v2 (Vázlat).');
  });
});
