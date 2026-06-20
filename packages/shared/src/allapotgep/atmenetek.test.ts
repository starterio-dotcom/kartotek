import { describe, it, expect } from 'vitest';
import {
  ATMENETEK,
  AUTO_ATMENETEK,
  VEGALLAPOTOK,
  atmenet,
  keziAtmenetek,
  vegallapot,
} from './atmenetek';
import { STATUSZOK } from '../tipusok';

describe('állapotgép — átmenet-tábla', () => {
  it('minden érvényes (honnan, művelet) pár megtalálható', () => {
    for (const a of ATMENETEK) {
      expect(atmenet(a.honnan, a.muvelet)).toBeDefined();
    }
  });

  it('érvénytelen (honnan, művelet) párra undefined', () => {
    expect(atmenet('Vázlat', 'jóváhagyás')).toBeUndefined();
    expect(atmenet('Archivált', 'beküldés')).toBeUndefined();
    expect(atmenet('Elavult', 'jóváhagyás')).toBeUndefined();
    expect(atmenet('Hatályos', 'beküldés')).toBeUndefined();
  });

  it('a végállapotokból nincs kézi átmenet', () => {
    for (const v of VEGALLAPOTOK) {
      expect(keziAtmenetek(v)).toHaveLength(0);
    }
  });

  it('az AUTO halmaz pontosan a két automata átmenet', () => {
    expect(AUTO_ATMENETEK.map((a) => a.muvelet).sort()).toEqual(['elavulás', 'hatálybalépés']);
    for (const a of AUTO_ATMENETEK) expect(a.mod).toBe('RENDSZER');
  });

  it('vegallapot() helyesen ismeri fel a végállapotokat', () => {
    expect(vegallapot('Archivált')).toBe(true);
    expect(vegallapot('Elvetve')).toBe(true);
    expect(vegallapot('Vázlat')).toBe(false);
    expect(vegallapot('Hatályos')).toBe(false);
  });

  it('a jóváhagyás négy-szem-elvű és hatálydátumot kér', () => {
    const j = atmenet('Véleményezés', 'jóváhagyás');
    expect(j?.negySzem).toBe(true);
    expect(j?.hatalyKell).toBe(true);
  });

  it('a visszadobás indoklást kér és veszélyes', () => {
    const v = atmenet('Véleményezés', 'visszadobás');
    expect(v?.indoklasKell).toBe(true);
    expect(v?.veszelyes).toBe(true);
  });

  it('az újverzió nem lépteti a forrásverziót (hova=null, ujVerzio)', () => {
    for (const honnan of ['Jóváhagyott', 'Hatályos'] as const) {
      const u = atmenet(honnan, 'újverzió');
      expect(u?.hova).toBeNull();
      expect(u?.ujVerzio).toBe(true);
    }
  });

  it('minden átmenet honnan/hova státusza érvényes enum-érték', () => {
    for (const a of ATMENETEK) {
      expect(STATUSZOK).toContain(a.honnan);
      if (a.hova !== null) expect(STATUSZOK).toContain(a.hova);
    }
  });
});
