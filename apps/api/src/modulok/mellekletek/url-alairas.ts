import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config.js';

/**
 * Aláírt melléklet-tartalom URL-ek (capability-URL minta). A tartalom-végpont
 * nem hitelesített munkamenetet vár, hanem egy rövid életre aláírt tokent a
 * query-ben — így a natív <img>/<video> is tölthet (nem küld auth-fejlécet),
 * de a bájtok mégsem publikusak: aláírás nélkül a végpont 401-et ad.
 *
 * Az aláírást a szerver az elem-válaszba teszi (lásd `elemValasz`), tehát csak
 * az kapja meg, aki az elemet amúgy is jogosult volt lekérni.
 */

function titok(): string {
  if (!config.mellekletTitok)
    throw new Error('MELLEKLET_URL_SECRET nincs beállítva — az aláírt URL-ek nem generálhatók.');
  return config.mellekletTitok;
}

function alairas(elemId: string, v: number, mid: string, exp: number): string {
  return createHmac('sha256', titok()).update(`${elemId}:${v}:${mid}:${exp}`).digest('hex');
}

/** A melléklet-tartalom aláírt (relatív) URL-je exp+sig query-vel. */
export function alairtTartalomUtvonal(
  elemId: string,
  v: number,
  mid: string,
  most: number = Date.now(),
): string {
  const exp = most + config.mellekletUrlTtlMs;
  const sig = alairas(elemId, v, mid, exp);
  return `/api/elemek/${elemId}/verziok/${v}/mellekletek/${mid}/tartalom?exp=${exp}&sig=${sig}`;
}

/** Igaz, ha az aláírás érvényes és még nem járt le (időzítés-biztos összevetés). */
export function ervenyesAlairas(
  elemId: string,
  v: number,
  mid: string,
  exp: number | undefined,
  sig: string | undefined,
  most: number = Date.now(),
): boolean {
  if (exp == null || !sig || !Number.isFinite(exp) || exp < most) return false;
  const vart = alairas(elemId, v, mid, exp);
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(sig, 'hex');
    b = Buffer.from(vart, 'hex');
  } catch {
    return false;
  }
  return a.length === b.length && timingSafeEqual(a, b);
}
