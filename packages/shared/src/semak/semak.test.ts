import { describe, it, expect } from 'vitest';
import { ElemLetrehozasDto, KapcsolatLetrehozasDto, JovahagyasDto, IndoklasDto } from './dto';
import { VerzioSchema } from './entitasok';

describe('Zod sémák — DTO-k', () => {
  it('ElemLetrehozasDto alapértékeket tölt', () => {
    const r = ElemLetrehozasDto.parse({ alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Reg' });
    expect(r.leirasMd).toBe('');
    expect(r.cimkek).toEqual([]);
  });

  it('KapcsolatLetrehozasDto pontosan egy célt követel', () => {
    expect(
      KapcsolatLetrehozasDto.safeParse({ forrasElemId: 'A', fajta: 'lebontja', celElemId: 'B' })
        .success,
    ).toBe(true);
    expect(
      KapcsolatLetrehozasDto.safeParse({ forrasElemId: 'A', fajta: 'lebontja' }).success,
    ).toBe(false);
    expect(
      KapcsolatLetrehozasDto.safeParse({
        forrasElemId: 'A',
        fajta: 'lebontja',
        celElemId: 'B',
        celKulsoLink: 'http://x',
      }).success,
    ).toBe(false);
  });

  it('JovahagyasDto a hatálykezdetet dátummá kényszeríti', () => {
    const r = JovahagyasDto.parse({ hatalyKezdet: '2026-06-17' });
    expect(r.hatalyKezdet).toBeInstanceOf(Date);
  });

  it('IndoklasDto üres indoklást elutasít', () => {
    expect(IndoklasDto.safeParse({ indoklas: '' }).success).toBe(false);
    expect(IndoklasDto.safeParse({ indoklas: 'mert' }).success).toBe(true);
  });

  it('VerzioSchema alapértelmezett státusza Vázlat', () => {
    const v = VerzioSchema.parse({
      verzioSzam: 1,
      cim: 'X',
      letrehozva: new Date(),
      modositottaId: 'u1',
    });
    expect(v.statusz).toBe('Vázlat');
    expect(v.mellekletek).toEqual([]);
  });
});
