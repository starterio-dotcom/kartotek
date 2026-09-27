import type { ExportAdat, ExportSor } from './adat.js';

/**
 * ReqIF 1.0.1 (OMG, http://www.omg.org/spec/ReqIF/20110401/reqif.xsd) export.
 * Az elemsorrend a hivatalos XSD szerinti (pl. SPEC-HIERARCHY: CHILDREN az OBJECT
 * ELŐTT; SPEC-RELATION: SOURCE, TARGET, TYPE). Minden attribútum STRING típusú (a
 * gazdag leírás sima szövegként); a hierarchia a lebontás-fa; relációt csak a mindkét
 * végén exportált elemek között adunk (a *-REF csak dokumentumon belüli ID lehet).
 */

// Az XML 1.0-ban nem megengedett karakterek (vezérlőkarakterek, párnélküli surrogate-ok).
// eslint-disable-next-line no-control-regex
const TILTOTT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Attribútum-érték: a sortörést/tabot karakterhivatkozásként kódoljuk (különben a
 *  feldolgozó az attribútum-normalizáláskor szóközzé alakítaná). */
export function xmlAttr(s: string): string {
  return (s ?? '')
    .replace(TILTOTT, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;')
    .replace(/\t/g, '&#9;');
}

export function xmlSzoveg(s: string): string {
  return (s ?? '').replace(TILTOTT, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** NCName-biztos azonosító-rész (az xsd:ID nem kezdődhet számmal, nem lehet benne szóköz/ékezet). */
export function ncnev(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.-]/g, '_');
}

const ATTRIBUTUMOK: { id: string; nev: string; ertek: (s: ExportSor) => string }[] = [
  { id: 'ad-kulcs', nev: 'Kulcs', ertek: (s) => s.kulcs },
  { id: 'ad-cim', nev: 'Cím', ertek: (s) => s.cim },
  { id: 'ad-tipus', nev: 'Típus', ertek: (s) => s.tipusKod },
  { id: 'ad-reteg', nev: 'Réteg', ertek: (s) => s.retegKod ?? '' },
  { id: 'ad-verzio', nev: 'Verzió', ertek: (s) => `v${s.verzioSzam}` },
  { id: 'ad-statusz', nev: 'Státusz', ertek: (s) => s.statusz },
  { id: 'ad-rovid', nev: 'Rövid leírás', ertek: (s) => s.rovid },
  { id: 'ad-leiras', nev: 'Részletes leírás', ertek: (s) => s.leiras },
  { id: 'ad-elofeltetelek', nev: 'Előfeltételek', ertek: (s) => s.elofeltetelek },
  { id: 'ad-kriteriumok', nev: 'Elfogadási kritériumok', ertek: (s) => s.kriteriumok },
  { id: 'ad-cia', nev: 'CIA (B/S/R)', ertek: (s) => s.cia },
  { id: 'ad-cimkek', nev: 'Címkék', ertek: (s) => s.cimkek.join(', ') },
  { id: 'ad-hataly-kezdet', nev: 'Hatály kezdete', ertek: (s) => s.hatalyKezdet ?? '' },
  { id: 'ad-hataly-veg', nev: 'Hatály vége', ertek: (s) => s.hatalyVeg ?? '' },
  { id: 'ad-szulok', nev: 'Lebontó szülők', ertek: (s) => s.szulok.join(', ') },
  { id: 'ad-kapcsolatok', nev: 'Kimenő kapcsolatok', ertek: (s) => s.kapcsolatok },
];

const soId = (id: string) => `so-${ncnev(id)}`;
const relTipusId = (fajta: string) => `srt-${ncnev(fajta)}`;

export function reqifKeszit(adat: ExportAdat): string {
  const t = adat.generalva.toISOString();
  const alk = ncnev(adat.alkalmazas.kod);
  const fajtak = [...new Set(adat.kapcsolatok.map((k) => k.fajta))].sort();
  const cim = `${adat.alkalmazas.nev} — specifikáció (${adat.mod === 'hatalyos' ? 'hatályos' : 'legújabb'} verziók)`;
  const k: string[] = [];

  k.push('<?xml version="1.0" encoding="UTF-8"?>');
  k.push('<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd" xmlns:xhtml="http://www.w3.org/1999/xhtml">');
  k.push('  <THE-HEADER>');
  k.push(`    <REQ-IF-HEADER IDENTIFIER="hdr-${alk}-${adat.generalva.getTime()}">`);
  k.push(`      <COMMENT>${xmlSzoveg(`Kartotékrendszer export — ${adat.alkalmazas.kod}`)}</COMMENT>`);
  k.push(`      <CREATION-TIME>${t}</CREATION-TIME>`);
  k.push('      <REQ-IF-TOOL-ID>Kartotekrendszer</REQ-IF-TOOL-ID>');
  k.push('      <REQ-IF-VERSION>1.0</REQ-IF-VERSION>');
  k.push('      <SOURCE-TOOL-ID>Kartotekrendszer</SOURCE-TOOL-ID>');
  k.push(`      <TITLE>${xmlSzoveg(cim)}</TITLE>`);
  k.push('    </REQ-IF-HEADER>');
  k.push('  </THE-HEADER>');
  k.push('  <CORE-CONTENT>');
  k.push('    <REQ-IF-CONTENT>');

  // DATATYPES
  k.push('      <DATATYPES>');
  k.push(`        <DATATYPE-DEFINITION-STRING IDENTIFIER="dt-szoveg" LAST-CHANGE="${t}" LONG-NAME="Szöveg" MAX-LENGTH="1000000"/>`);
  k.push('      </DATATYPES>');

  // SPEC-TYPES
  k.push('      <SPEC-TYPES>');
  k.push(`        <SPEC-OBJECT-TYPE IDENTIFIER="sot-kartotek" LAST-CHANGE="${t}" LONG-NAME="Kartoték-elem">`);
  k.push('          <SPEC-ATTRIBUTES>');
  for (const a of ATTRIBUTUMOK) {
    k.push(`            <ATTRIBUTE-DEFINITION-STRING IDENTIFIER="${a.id}" LAST-CHANGE="${t}" LONG-NAME="${xmlAttr(a.nev)}">`);
    k.push('              <TYPE><DATATYPE-DEFINITION-STRING-REF>dt-szoveg</DATATYPE-DEFINITION-STRING-REF></TYPE>');
    k.push('            </ATTRIBUTE-DEFINITION-STRING>');
  }
  k.push('          </SPEC-ATTRIBUTES>');
  k.push('        </SPEC-OBJECT-TYPE>');
  for (const f of fajtak)
    k.push(`        <SPEC-RELATION-TYPE IDENTIFIER="${relTipusId(f)}" LAST-CHANGE="${t}" LONG-NAME="${xmlAttr(f)}"/>`);
  k.push(`        <SPECIFICATION-TYPE IDENTIFIER="spt-specifikacio" LAST-CHANGE="${t}" LONG-NAME="Specifikáció"/>`);
  k.push('      </SPEC-TYPES>');

  // SPEC-OBJECTS
  k.push('      <SPEC-OBJECTS>');
  for (const s of adat.sorok) {
    k.push(`        <SPEC-OBJECT IDENTIFIER="${soId(s.id)}" LAST-CHANGE="${s.modositva}" LONG-NAME="${xmlAttr(s.kulcs)}">`);
    k.push('          <VALUES>');
    for (const a of ATTRIBUTUMOK) {
      k.push(`            <ATTRIBUTE-VALUE-STRING THE-VALUE="${xmlAttr(a.ertek(s))}">`);
      k.push(`              <DEFINITION><ATTRIBUTE-DEFINITION-STRING-REF>${a.id}</ATTRIBUTE-DEFINITION-STRING-REF></DEFINITION>`);
      k.push('            </ATTRIBUTE-VALUE-STRING>');
    }
    k.push('          </VALUES>');
    k.push('          <TYPE><SPEC-OBJECT-TYPE-REF>sot-kartotek</SPEC-OBJECT-TYPE-REF></TYPE>');
    k.push('        </SPEC-OBJECT>');
  }
  k.push('      </SPEC-OBJECTS>');

  // SPEC-RELATIONS (sorrend az XSD szerint: SOURCE, TARGET, TYPE)
  if (adat.kapcsolatok.length) {
    k.push('      <SPEC-RELATIONS>');
    for (const r of adat.kapcsolatok) {
      k.push(`        <SPEC-RELATION IDENTIFIER="sr-${ncnev(r.id)}" LAST-CHANGE="${r.modositva}" LONG-NAME="${xmlAttr(r.fajta)}">`);
      k.push(`          <SOURCE><SPEC-OBJECT-REF>${soId(r.forrasId)}</SPEC-OBJECT-REF></SOURCE>`);
      k.push(`          <TARGET><SPEC-OBJECT-REF>${soId(r.celId)}</SPEC-OBJECT-REF></TARGET>`);
      k.push(`          <TYPE><SPEC-RELATION-TYPE-REF>${relTipusId(r.fajta)}</SPEC-RELATION-TYPE-REF></TYPE>`);
      k.push('        </SPEC-RELATION>');
    }
    k.push('      </SPEC-RELATIONS>');
  }

  // SPECIFICATIONS — a lebontás-fa (SPEC-HIERARCHY: CHILDREN az OBJECT ELŐTT)
  const hierarchia = (id: string, behuz: string): void => {
    const gyk = adat.gyerekek.get(id) ?? [];
    k.push(`${behuz}<SPEC-HIERARCHY IDENTIFIER="sh-${ncnev(id)}" LAST-CHANGE="${t}">`);
    if (gyk.length) {
      k.push(`${behuz}  <CHILDREN>`);
      for (const gy of gyk) hierarchia(gy, `${behuz}    `);
      k.push(`${behuz}  </CHILDREN>`);
    }
    k.push(`${behuz}  <OBJECT><SPEC-OBJECT-REF>${soId(id)}</SPEC-OBJECT-REF></OBJECT>`);
    k.push(`${behuz}</SPEC-HIERARCHY>`);
  };
  k.push('      <SPECIFICATIONS>');
  k.push(`        <SPECIFICATION IDENTIFIER="sp-${alk}" LAST-CHANGE="${t}" LONG-NAME="${xmlAttr(adat.alkalmazas.nev)}">`);
  if (adat.gyokerek.length) {
    k.push('          <CHILDREN>');
    for (const g of adat.gyokerek) hierarchia(g, '            ');
    k.push('          </CHILDREN>');
  }
  k.push('          <TYPE><SPECIFICATION-TYPE-REF>spt-specifikacio</SPECIFICATION-TYPE-REF></TYPE>');
  k.push('        </SPECIFICATION>');
  k.push('      </SPECIFICATIONS>');

  k.push('    </REQ-IF-CONTENT>');
  k.push('  </CORE-CONTENT>');
  k.push('</REQ-IF>');
  return k.join('\n') + '\n';
}
