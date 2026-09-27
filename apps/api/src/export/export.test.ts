import { describe, it, expect } from 'vitest';
import { csvCella, csvKeszit } from './csv.js';
import { reqifKeszit, xmlAttr, ncnev } from './reqif.js';
import type { ExportAdat, ExportSor } from './adat.js';

const sor = (id: string, kulcs: string, extra: Partial<ExportSor> = {}): ExportSor => ({
  id,
  kulcs,
  tipusKod: 'BUS',
  retegKod: null,
  melyseg: 0,
  szuloKulcs: null,
  szulok: [],
  verzioSzam: 1,
  statusz: 'Hatályos',
  cim: `Cím ${kulcs}`,
  rovid: '',
  leiras: '',
  elofeltetelek: '',
  kriteriumok: '',
  cia: '',
  cimkek: [],
  hatalyKezdet: null,
  hatalyVeg: null,
  kapcsolatok: '',
  modositva: '2026-09-27T10:00:00.000Z',
  ...extra,
});

const adat: ExportAdat = {
  alkalmazas: { kod: '3R', nev: 'Rendezvény & regisztráció', leiras: '' },
  mod: 'legujabb',
  generalva: new Date('2026-09-27T10:00:00.000Z'),
  sorok: [
    sor('6a1', '3R-BUS-001', { leiras: 'Első sor\nMásodik "idézett" sor <b>' }),
    sor('6a2', '3R-TUC-001', { tipusKod: 'TUC', melyseg: 1, szuloKulcs: '3R-BUS-001' }),
  ],
  kapcsolatok: [{ id: 'k1', forrasId: '6a1', celId: '6a2', fajta: 'függ tőle', modositva: '2026-09-27T10:00:00.000Z' }],
  gyerekek: new Map([['6a1', ['6a2']]]),
  gyokerek: ['6a1'],
};

describe('CSV', () => {
  it('idézi az elválasztót, az idézőjelet és a sortörést tartalmazó cellát', () => {
    expect(csvCella('a;b', ';')).toBe('"a;b"');
    expect(csvCella('mondta: "igen"', ';')).toBe('"mondta: ""igen"""');
    expect(csvCella('két\nsor', ';')).toBe('"két\nsor"');
    expect(csvCella('sima', ';')).toBe('sima');
  });

  it('képlet-injektálás ellen: = + - @ kezdetű cella szövegként', () => {
    expect(csvCella('=HYPERLINK("x")', ';')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCella('+36 1 234', ';')).toBe("'+36 1 234");
    expect(csvCella('@SUM(A1)', ';')).toBe("'@SUM(A1)");
  });

  it('UTF-8 BOM + fejléc + soronként egy elem, a fa sorrendjében', () => {
    const csv = csvKeszit(adat);
    expect(csv.startsWith('﻿Kulcs;Típus;')).toBe(true);
    // A rekordelválasztó \r\n; az idézett cellán belüli \n nem tör rekordot.
    const sorok = csv.trim().split('\r\n');
    expect(sorok).toHaveLength(1 + 2); // fejléc + 2 elem
    expect(csv).toContain('3R-TUC-001;TUC;;1;3R-BUS-001');
  });
});

describe('ReqIF', () => {
  const xml = reqifKeszit(adat);

  it('attribútum-értékben a sortörés karakterhivatkozás, a speciális karakterek escape-elve', () => {
    expect(xmlAttr('a\nb "c" <d> & e')).toBe('a&#10;b &quot;c&quot; &lt;d&gt; &amp; e');
    expect(xml).toContain('THE-VALUE="Első sor&#10;Második &quot;idézett&quot; sor &lt;b&gt;"');
  });

  it('az azonosítók NCName-biztosak (nem kezdődnek számmal, nincs ékezet/szóköz)', () => {
    expect(ncnev('függ tőle')).toBe('fugg_tole');
    const idk = [...xml.matchAll(/IDENTIFIER="([^"]+)"/g)].map((m) => m[1]!);
    for (const id of idk) expect(id).toMatch(/^[A-Za-z_][A-Za-z0-9_.-]*$/);
    expect(new Set(idk).size).toBe(idk.length); // egyediek
  });

  it('XSD-sorrend: SPEC-HIERARCHY-ben a CHILDREN az OBJECT előtt; SPEC-RELATION: SOURCE, TARGET, TYPE', () => {
    const h = xml.slice(xml.indexOf('<SPEC-HIERARCHY IDENTIFIER="sh-6a1"'));
    expect(h.indexOf('<CHILDREN>')).toBeLessThan(h.indexOf('<OBJECT><SPEC-OBJECT-REF>so-6a1<'));
    const r = xml.slice(xml.indexOf('<SPEC-RELATION '), xml.indexOf('</SPEC-RELATION>'));
    expect(r.indexOf('<SOURCE>')).toBeLessThan(r.indexOf('<TARGET>'));
    expect(r.indexOf('<TARGET>')).toBeLessThan(r.indexOf('<TYPE>'));
  });

  it('minden hivatkozás dokumentumon belüli azonosítóra mutat', () => {
    const idk = new Set([...xml.matchAll(/IDENTIFIER="([^"]+)"/g)].map((m) => m[1]!));
    const refek = [...xml.matchAll(/<[A-Z-]+-REF>([^<]+)</g)].map((m) => m[1]!);
    expect(refek.length).toBeGreaterThan(0);
    for (const ref of refek) expect(idk.has(ref)).toBe(true);
  });

  it('jól formált: minden nyitó elemnek van záró párja', () => {
    const verem: string[] = [];
    for (const m of xml.matchAll(/<(\/?)([A-Za-z-:]+)[^>]*?(\/?)>/g)) {
      const [, zaro, nev, onzaro] = m;
      if (nev === '?xml' || onzaro) continue;
      if (zaro) expect(verem.pop()).toBe(nev);
      else verem.push(nev!);
    }
    expect(verem).toEqual([]);
  });
});
