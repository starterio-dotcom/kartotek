import { describe, it, expect } from 'vitest';
import { ertesitesSzoveg } from './sablon.js';
import { emailEngedett } from './email.js';

describe('értesítés-sablon', () => {
  const alap = {
    elemKulcs: '3R-BUS-002',
    verzioSzam: 2,
    cim: 'Regisztráció <script>',
    kiNev: 'Nagy Péter',
    hivatkozas: 'https://aru.hu/elem/abc',
  };

  it('tárgy és egysoros üzenet eseményenként', () => {
    expect(ertesitesSzoveg({ ...alap, esemeny: 'bekuldes' }).targy).toBe('Véleményezésre vár: 3R-BUS-002 v2');
    const v = ertesitesSzoveg({ ...alap, esemeny: 'visszadobas', reszlet: 'Hiányos.' });
    expect(v.targy).toBe('Visszadobva: 3R-BUS-002 v2');
    expect(v.uzenet).toContain('„Hiányos."');
  });

  it('a HTML-ben a felhasználói tartalom escape-elve, a szövegesben a hivatkozás', () => {
    const s = ertesitesSzoveg({ ...alap, esemeny: 'megjegyzes', reszlet: '<img src=x onerror=alert(1)>' });
    expect(s.html).not.toContain('<script>');
    expect(s.html).not.toContain('<img');
    expect(s.html).toContain('&lt;script&gt;');
    expect(s.szoveg).toContain('https://aru.hu/elem/abc');
  });
});

describe('engedélyezett-domain szelep', () => {
  it('lista nélkül minden cím mehet', () => {
    expect(emailEngedett('barki@pelda.hu', undefined)).toBe(true);
  });
  it('listával csak az engedélyezett domain', () => {
    expect(emailEngedett('olivér@gmail.com'.replace('é', 'e'), ['gmail.com'])).toBe(true);
    expect(emailEngedett('kiss.anna@pelda.hu', ['gmail.com'])).toBe(false);
    expect(emailEngedett('ROSSZ', ['gmail.com'])).toBe(false);
  });
});
