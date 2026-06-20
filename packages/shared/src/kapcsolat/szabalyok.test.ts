import { describe, it, expect } from 'vitest';
import {
  kapcsolatValidacio,
  celFajta,
  elerheto,
  type KapcsolatCtx,
  type UjKapcsolat,
} from './szabalyok';

const ures: KapcsolatCtx = {
  forrasTipus: 'BUS',
  meglevoKapcsolatok: [],
  lebontjaElek: [],
};

const k = (p: Partial<UjKapcsolat>): UjKapcsolat => ({
  forrasElemId: 'A',
  fajta: 'lebontja',
  ...p,
});

describe('kapcsolat — célfajta meghatározása', () => {
  it('pontosan egy cél-mező → a megfelelő fajta', () => {
    expect(celFajta(k({ celElemId: 'B' }))).toBe('elem');
    expect(celFajta(k({ celSzabalyzatKod: 'IB-1' }))).toBe('szabályzat');
    expect(celFajta(k({ celKulsoLink: 'http://x' }))).toBe('külső');
  });
  it('hiányzó / több cél', () => {
    expect(celFajta(k({}))).toBe('hiányzó');
    expect(celFajta(k({ celElemId: 'B', celKulsoLink: 'http://x' }))).toBe('több');
  });
});

describe('kapcsolat — cél-megszorítás fajtánként', () => {
  it('megfelel célja kötelezően szabályzat', () => {
    expect(
      kapcsolatValidacio(k({ fajta: 'megfelel', celSzabalyzatKod: 'IB-1' }), ures).ervenyes,
    ).toBe(true);
    expect(kapcsolatValidacio(k({ fajta: 'megfelel', celElemId: 'B' }), ures).ervenyes).toBe(false);
  });

  it('lebontja / függ tőle / leváltja célja elem kell legyen', () => {
    for (const fajta of ['lebontja', 'függ tőle', 'leváltja'] as const) {
      expect(
        kapcsolatValidacio(k({ fajta, celSzabalyzatKod: 'IB-1' }), {
          ...ures,
          forrasTipus: 'TUS',
        }).ervenyes,
      ).toBe(false);
    }
  });

  it('hivatkozik elfogad belső elemet és külső linket is', () => {
    expect(
      kapcsolatValidacio(k({ fajta: 'hivatkozik', celKulsoLink: 'http://x' }), ures).ervenyes,
    ).toBe(true);
    expect(
      kapcsolatValidacio(k({ fajta: 'hivatkozik', celElemId: 'B' }), { ...ures, celTipus: 'BD' })
        .ervenyes,
    ).toBe(true);
  });
});

describe('kapcsolat — speciális szabályok', () => {
  it('hivatkozik belső célja csak BD vagy TD', () => {
    expect(
      kapcsolatValidacio(k({ fajta: 'hivatkozik', celElemId: 'B' }), { ...ures, celTipus: 'TD' })
        .ervenyes,
    ).toBe(true);
    expect(
      kapcsolatValidacio(k({ fajta: 'hivatkozik', celElemId: 'B' }), { ...ures, celTipus: 'TUS' })
        .ervenyes,
    ).toBe(false);
  });

  it('leváltja csak azonos típusok között', () => {
    expect(
      kapcsolatValidacio(k({ fajta: 'leváltja', celElemId: 'B' }), {
        ...ures,
        forrasTipus: 'TUS',
        celTipus: 'TUS',
      }).ervenyes,
    ).toBe(true);
    expect(
      kapcsolatValidacio(k({ fajta: 'leváltja', celElemId: 'B' }), {
        ...ures,
        forrasTipus: 'TUS',
        celTipus: 'BUS',
      }).ervenyes,
    ).toBe(false);
  });

  it('leváltja sikernél felajánlja az Elavultba léptetést', () => {
    const e = kapcsolatValidacio(k({ fajta: 'leváltja', celElemId: 'B' }), {
      ...ures,
      forrasTipus: 'TUS',
      celTipus: 'TUS',
    });
    expect(e.felajanlElavultat).toBe(true);
  });

  it('önhivatkozás tiltott', () => {
    expect(
      kapcsolatValidacio(k({ fajta: 'függ tőle', forrasElemId: 'A', celElemId: 'A' }), {
        ...ures,
        forrasTipus: 'TUS',
        celTipus: 'TUS',
      }).ervenyes,
    ).toBe(false);
  });

  it('duplikátum tiltott (azonos forrás-cél-fajta)', () => {
    const ctx: KapcsolatCtx = {
      ...ures,
      celTipus: 'TUS',
      meglevoKapcsolatok: [
        { celElemId: 'B', celSzabalyzatKod: null, celKulsoLink: null, fajta: 'lebontja' },
      ],
    };
    expect(kapcsolatValidacio(k({ celElemId: 'B', fajta: 'lebontja' }), ctx).ervenyes).toBe(false);
    // más fajta ugyanarra a célra megengedett
    expect(kapcsolatValidacio(k({ celElemId: 'B', fajta: 'függ tőle' }), ctx).ervenyes).toBe(true);
  });
});

describe('kapcsolat — lebontja ciklusellenőrzés', () => {
  it('közvetlen kör tiltott (B→A létezik, A→B tiltott)', () => {
    const ctx: KapcsolatCtx = { ...ures, lebontjaElek: [{ forras: 'B', cel: 'A' }] };
    expect(kapcsolatValidacio(k({ forrasElemId: 'A', celElemId: 'B' }), ctx).ervenyes).toBe(false);
  });

  it('közvetett kör tiltott (B→C→A létezik, A→B tiltott)', () => {
    const ctx: KapcsolatCtx = {
      ...ures,
      lebontjaElek: [
        { forras: 'B', cel: 'C' },
        { forras: 'C', cel: 'A' },
      ],
    };
    expect(kapcsolatValidacio(k({ forrasElemId: 'A', celElemId: 'B' }), ctx).ervenyes).toBe(false);
  });

  it('körmentes él megengedett', () => {
    const ctx: KapcsolatCtx = { ...ures, lebontjaElek: [{ forras: 'A', cel: 'B' }] };
    expect(kapcsolatValidacio(k({ forrasElemId: 'A', celElemId: 'C' }), ctx).ervenyes).toBe(true);
  });

  it('elerheto() irányítottan jár be', () => {
    const elek = [
      { forras: 'A', cel: 'B' },
      { forras: 'B', cel: 'C' },
    ];
    expect(elerheto('A', 'C', elek)).toBe(true);
    expect(elerheto('C', 'A', elek)).toBe(false);
  });
});
