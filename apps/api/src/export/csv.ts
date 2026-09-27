import type { ExportAdat } from './adat.js';

/**
 * CSV-cella. Két védelem:
 *  - képlet-injektálás (OWASP): az `= + - @` (és tab/CR) kezdetű cellát a táblázatkezelő
 *    képletként futtathatná — aposztróffal szövegként jelöljük;
 *  - RFC 4180 idézés: elválasztó, idézőjel vagy sortörés esetén idézőjelbe tesszük.
 */
export function csvCella(ertek: string, elvalaszto: string): string {
  let s = ertek ?? '';
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(elvalaszto) || /["\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const FEJLEC = [
  'Kulcs',
  'Típus',
  'Réteg',
  'Szint',
  'Lebontó szülő',
  'Összes lebontó szülő',
  'Verzió',
  'Státusz',
  'Cím',
  'Rövid leírás',
  'Részletes leírás',
  'Előfeltételek',
  'Elfogadási kritériumok',
  'CIA (B/S/R)',
  'Címkék',
  'Hatály kezdete',
  'Hatály vége',
  'Kimenő kapcsolatok',
];

/**
 * CSV a lebontás-fa sorrendjében. Alapból `;` elválasztó + UTF-8 BOM: a magyar
 * területi beállítású Excel így ékezethelyesen, oszlopokra bontva nyitja meg.
 */
export function csvKeszit(adat: ExportAdat, elvalaszto = ';'): string {
  const sor = (cellak: string[]) => cellak.map((c) => csvCella(c, elvalaszto)).join(elvalaszto);
  const sorok = adat.sorok.map((s) =>
    sor([
      s.kulcs,
      s.tipusKod,
      s.retegKod ?? '',
      String(s.melyseg),
      s.szuloKulcs ?? '',
      s.szulok.join(', '),
      `v${s.verzioSzam}`,
      s.statusz,
      s.cim,
      s.rovid,
      s.leiras,
      s.elofeltetelek,
      s.kriteriumok,
      s.cia,
      s.cimkek.join(', '),
      s.hatalyKezdet ?? '',
      s.hatalyVeg ?? '',
      s.kapcsolatok,
    ]),
  );
  return '﻿' + [sor(FEJLEC), ...sorok].join('\r\n') + '\r\n';
}
