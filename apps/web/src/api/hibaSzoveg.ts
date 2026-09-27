import { ApiHiba, HALOZATI_HIBA, statuszSzoveg } from './kliens';

/** A backend mezőnevei a felhasználó nyelvén (a Zod-hibák útvonalához). */
const MEZO_NEV: Record<string, string> = {
  cim: 'Cím',
  leirasMd: 'Leírás',
  leiras: 'Részletes leírás',
  alkalmazasKod: 'Alkalmazás',
  tipusKod: 'Típus',
  retegKod: 'Réteg',
  cimkek: 'Címkék',
  celElemId: 'Cél elem',
  celSzabalyzatKod: 'Szabályzat kódja',
  celKulsoLink: 'Külső link',
  figmaLink: 'Figma-link',
  hatalyKezdet: 'Hatály kezdete',
  hatalyVeg: 'Hatály vége',
  indoklas: 'Indoklás',
  szoveg: 'Szöveg',
  kod: 'Kód',
  nev: 'Név',
  ok: 'Indoklás',
  verzio: 'Verzió',
  datum: 'Dátum',
};

interface ZodSzeruHiba {
  code?: string;
  keyword?: string;
  message?: string;
  path?: (string | number)[];
  instancePath?: string;
  validation?: string;
  minimum?: number;
  maximum?: number;
  type?: string;
  received?: string;
  params?: { issue?: ZodSzeruHiba };
}

function mezoNev(h: ZodSzeruHiba): string | null {
  const ut = h.path ?? (h.instancePath ? h.instancePath.split('/').filter(Boolean) : []);
  const utolso = [...ut].reverse().find((x) => typeof x === 'string') as string | undefined;
  return utolso ? (MEZO_NEV[utolso] ?? utolso) : null;
}

function issueSzoveg(h: ZodSzeruHiba): string {
  switch (h.code ?? h.keyword) {
    case 'invalid_string':
      if (h.validation === 'url') return 'érvénytelen webcím (https://… formában add meg)';
      if (h.validation === 'email') return 'érvénytelen e-mail-cím';
      return 'érvénytelen formátum';
    case 'too_small':
      if (h.type === 'string') return h.minimum === 1 ? 'kötelező megadni' : `legalább ${h.minimum} karakter`;
      if (h.type === 'array') return h.minimum === 1 ? 'legalább egy elem kell' : `legalább ${h.minimum} elem kell`;
      return `legalább ${h.minimum}`;
    case 'too_big':
      return h.type === 'string' ? `legfeljebb ${h.maximum} karakter` : `legfeljebb ${h.maximum}`;
    case 'invalid_type':
      return h.received === 'undefined' || h.received === 'null' ? 'kötelező megadni' : 'érvénytelen érték';
    case 'invalid_enum_value':
    case 'invalid_literal':
      return 'nem választható érték';
    case 'invalid_date':
      return 'érvénytelen dátum';
    default:
      return h.message ?? 'érvénytelen érték';
  }
}

/** A `reszletek` mező (Zod-issue-k, Fastify-validáció vagy szöveglista) olvasható formában. */
export function reszletekSzoveg(reszletek: unknown): string | null {
  if (!Array.isArray(reszletek) || reszletek.length === 0) return null;
  const sorok = reszletek.map((r) => {
    if (typeof r === 'string') return r;
    if (r && typeof r === 'object') {
      const h = r as ZodSzeruHiba;
      const issue = h.params?.issue ?? h; // a Fastify-validáció a Zod-issue-t becsomagolja
      const nev = mezoNev(issue) ?? mezoNev(h);
      const sz = issueSzoveg(issue);
      return nev ? `${nev}: ${sz}` : sz;
    }
    return String(r);
  });
  return [...new Set(sorok)].join('; ');
}

/**
 * Bármely hibából a felhasználónak szóló, magyar, cselekvésre ösztönző szöveg —
 * soha „Failed to fetch", „Unexpected token '<'" vagy „[object Object]".
 */
export function hibaSzoveg(hiba: unknown): string {
  if (hiba instanceof ApiHiba) {
    const reszlet = reszletekSzoveg(hiba.reszletek);
    if (reszlet) return hiba.message === 'Érvénytelen bemenet' ? `Hibás adat — ${reszlet}` : `${hiba.message} (${reszlet})`;
    return hiba.message;
  }
  if (hiba instanceof TypeError && /fetch|network|load failed/i.test(hiba.message)) return HALOZATI_HIBA;
  if (hiba instanceof SyntaxError) return 'A szerver váratlan választ adott — próbáld újra pár perc múlva.';
  if (hiba instanceof Error && hiba.message) return hiba.message;
  return 'Váratlan hiba történt — próbáld újra.';
}

export { statuszSzoveg };
