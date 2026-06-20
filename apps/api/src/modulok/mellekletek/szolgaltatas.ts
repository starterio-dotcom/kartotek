import { randomUUID } from 'node:crypto';
import type { MellekletTipus } from '@kartotek/shared';
import { hiba400, hiba404, hiba409 } from '../../hibak.js';
import { ellenoriz } from '../../auth/rbac.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';
import type { Tarhely } from '../../tarhely/tarhely.js';
import { elemBetolt, verzioKeres, elemValasz } from '../kozos.js';

type Valasz = Record<string, unknown>;

/** Csak Vázlat verzión módosíthatók a mellékletek (Hatályossá váláskor befagynak). */
function szabadModositani(statusz: string): void {
  if (statusz !== 'Vázlat')
    throw hiba409('A melléklet csak Vázlat státuszú verzión módosítható (a tartalom befagyott).');
}

function tipusMimebol(mime: string, fajlNev: string): MellekletTipus {
  if (mime.startsWith('image/')) return 'kep';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'text/csv' || mime === 'application/csv' || fajlNev.toLowerCase().endsWith('.csv'))
    return 'csv';
  throw hiba400(`Nem támogatott melléklettípus: ${mime || fajlNev}`);
}

export interface FeltoltesBe {
  buffer: Buffer;
  fajlNev: string;
  mime: string;
  alt?: string;
  figmaLink?: string;
}

/** Fájlfeltöltés: kép, CSV, vagy Figma-pillanatkép (ha `figmaLink` is jön). */
export async function mellekletFeltoltes(
  tarhely: Tarhely,
  id: string,
  vsz: number,
  be: FeltoltesBe,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, vsz);
  ellenoriz('melléklet.kezelés', felh, { alkalmazasKod: elem.alkalmazasKod });
  szabadModositani(v.statusz);

  const tipus: MellekletTipus = be.figmaLink ? 'figma' : tipusMimebol(be.mime, be.fajlNev);
  const ref = await tarhely.ment(be.buffer);

  v.mellekletek.push({
    mid: `m_${randomUUID()}`,
    tipus,
    alt: be.alt || be.fajlNev,
    tartalomHiv: ref,
    mime: be.mime,
    ...(tipus === 'figma' ? { figmaPng: ref, ...(be.figmaLink ? { figmaLink: be.figmaLink } : {}) } : {}),
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}

/** Figma-keret pillanatkép nélkül: csak élő link (a node-id URL-kódolt kettősponttal). */
export async function figmaLinkFelvetel(
  id: string,
  vsz: number,
  be: { alt: string; figmaLink: string },
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, vsz);
  ellenoriz('melléklet.kezelés', felh, { alkalmazasKod: elem.alkalmazasKod });
  szabadModositani(v.statusz);

  v.mellekletek.push({
    mid: `m_${randomUUID()}`,
    tipus: 'figma',
    alt: be.alt,
    tartalomHiv: be.figmaLink, // nincs pillanatkép, csak az élő link
    figmaLink: be.figmaLink,
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function mellekletTorles(
  tarhely: Tarhely,
  id: string,
  vsz: number,
  mid: string,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, vsz);
  ellenoriz('melléklet.kezelés', felh, { alkalmazasKod: elem.alkalmazasKod });
  szabadModositani(v.statusz);

  const idx = v.mellekletek.findIndex((x) => x.mid === mid);
  if (idx < 0) throw hiba404('Melléklet nem található.');
  const m = v.mellekletek[idx]!;
  if (m.tartalomHiv) await tarhely.torol(m.tartalomHiv);
  v.mellekletek.splice(idx, 1);
  await elem.save();
  return elemValasz(elem.toObject());
}

export interface Tartalom {
  buffer: Buffer;
  mime: string;
  fajlNev: string;
}

/** A melléklet bájtjai kiszolgáláshoz (vagy `null`, ha nincs tárolt fájl). */
export async function mellekletTartalom(
  tarhely: Tarhely,
  id: string,
  vsz: number,
  mid: string,
): Promise<Tartalom | null> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, vsz);
  const m = v.mellekletek.find((x) => x.mid === mid);
  if (!m) throw hiba404('Melléklet nem található.');
  const ref = m.figmaPng ?? m.tartalomHiv;
  if (!ref) return null;
  const buffer = await tarhely.olvas(ref);
  if (!buffer) return null;
  return { buffer, mime: m.mime ?? 'application/octet-stream', fajlNev: m.alt };
}
