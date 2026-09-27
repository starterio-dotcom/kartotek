const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const TAR_KULCS = 'kartotek.felhasznalo-email';

/** A dev-hitelesítéshez használt aktuális felhasználó e-mailje (fejlécbe kerül). */
let aktualisEmail: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(TAR_KULCS) : null;

export function aktualisEmailLeker(): string | null {
  return aktualisEmail;
}

export function aktualisEmailBeallit(email: string | null): void {
  aktualisEmail = email;
  if (typeof localStorage !== 'undefined') {
    if (email) localStorage.setItem(TAR_KULCS, email);
    else localStorage.removeItem(TAR_KULCS);
  }
}

/** OIDC hozzáférési token (Bearer). Ha be van állítva, a dev-fejléc helyett ezt küldjük. */
let aktualisToken: string | null = null;

export function aktualisTokenBeallit(token: string | null): void {
  aktualisToken = token;
}

/** A hitelesítő fejléc(ek) összeállítása: OIDC Bearer elsőbbség, különben dev-fejléc. */
function authFejlec(): Record<string, string> {
  if (aktualisToken) return { authorization: `Bearer ${aktualisToken}` };
  if (aktualisEmail) return { 'x-felhasznalo-email': aktualisEmail };
  return {};
}

export class ApiHiba extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public reszletek?: unknown,
  ) {
    super(message);
  }
}

export const HALOZATI_HIBA = 'A szerver nem érhető el — ellenőrizd a hálózati kapcsolatot, és próbáld újra.';

/** Ha a válasz nem hordoz saját üzenetet (pl. a proxy 502-es HTML-oldala), státuszfüggő magyar szöveg. */
export function statuszSzoveg(statusz: number): string {
  if (statusz === 401) return 'Lejárt vagy hiányzik a bejelentkezés — jelentkezz be újra.';
  if (statusz === 403) return 'Ehhez a művelethez nincs jogosultságod.';
  if (statusz === 404) return 'A keresett tétel nem található (lehet, hogy közben törölték).';
  if (statusz === 413) return 'A fájl túl nagy a feltöltéshez.';
  if (statusz === 429) return 'Túl sok kérés rövid idő alatt — várj egy kicsit, és próbáld újra.';
  if (statusz >= 500) return `A szerver átmenetileg nem érhető el (HTTP ${statusz}) — próbáld újra pár perc múlva.`;
  return `A kérés nem sikerült (HTTP ${statusz}).`;
}

/** fetch hálózati hibával → ApiHiba(0) magyar üzenettel („Failed to fetch" helyett). */
async function halozat(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiHiba(0, HALOZATI_HIBA);
  }
}

/** A válasz törzse JSON-ként; ha nem JSON (HTML-hibaoldal), a státusz alapján értelmes hiba. */
async function jsonTorzs(res: Response): Promise<{ hiba?: string; reszletek?: unknown } & Record<string, unknown> | undefined> {
  const szoveg = await res.text();
  if (!szoveg) return undefined;
  try {
    return JSON.parse(szoveg);
  } catch {
    throw new ApiHiba(res.status, res.ok ? 'A szerver váratlan választ adott — próbáld újra.' : statuszSzoveg(res.status));
  }
}

function valaszHiba(res: Response, adat: { hiba?: string; reszletek?: unknown } | undefined): ApiHiba {
  return new ApiHiba(res.status, adat?.hiba || statuszSzoveg(res.status), adat?.reszletek);
}

async function keresValasz<T>(
  utvonal: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<{ adat: T; res: Response }> {
  const fejlec: Record<string, string> = { ...authFejlec() };
  if (opts.body !== undefined) fejlec['content-type'] = 'application/json';

  const res = await halozat(`${API_URL}${utvonal}`, {
    method: opts.method ?? 'GET',
    headers: fejlec,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (res.status === 204) return { adat: undefined as T, res };

  const adat = await jsonTorzs(res);
  if (!res.ok) throw valaszHiba(res, adat);
  return { adat: adat as T, res };
}

async function keres<T>(utvonal: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  return (await keresValasz<T>(utvonal, opts)).adat;
}

/** Lapozott lista: a törzs + az összes találat száma (X-Osszes fejléc). */
export async function getLapozott<T>(utvonal: string): Promise<{ adat: T[]; osszes: number }> {
  const { adat, res } = await keresValasz<T[]>(utvonal);
  const fejlec = res.headers.get('x-osszes');
  return { adat, osszes: fejlec !== null ? Number(fejlec) : adat.length };
}

/** Nyers (bináris) lekérés a melléklet-tartalomhoz — a dev-fejléccel együtt. */
export async function tartalomFetch(utvonal: string): Promise<Response> {
  return fetch(`${API_URL}${utvonal}`, { headers: { ...authFejlec() } });
}

/**
 * Hitelesített fájlletöltés (export): a végpont auth-fejlécet kér, ezért egy sima
 * <a href> nem működne — fetch → blob → ideiglenes letöltő link. A fájlnevet a
 * szerver Content-Disposition fejléce adja.
 */
export async function letoltes(utvonal: string, tartalekNev: string): Promise<void> {
  const res = await halozat(`${API_URL}${utvonal}`, { headers: { ...authFejlec() } });
  if (!res.ok) throw valaszHiba(res, await jsonTorzs(res).catch(() => undefined));
  const nev = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? tartalekNev;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nev;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function apiUrl(utvonal: string): string {
  return `${API_URL}${utvonal}`;
}

/** Fájlfeltöltés multipart/form-data formában (a böngésző állítja be a content-type-ot). */
export async function feltoltFajl<T>(
  utvonal: string,
  file: File,
  mezok: Record<string, string> = {},
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(mezok)) form.append(k, v);
  const fejlec: Record<string, string> = { ...authFejlec() };

  const res = await halozat(`${API_URL}${utvonal}`, { method: 'POST', headers: fejlec, body: form });
  const adat = await jsonTorzs(res).catch((e) => {
    if (!res.ok) return undefined; // a hibaoldal (pl. 413) nem JSON — a státusz dönt
    throw e;
  });
  if (!res.ok) throw valaszHiba(res, adat);
  return adat as T;
}

export const api = {
  get: <T>(u: string) => keres<T>(u),
  post: <T>(u: string, body?: unknown) => keres<T>(u, { method: 'POST', body }),
  patch: <T>(u: string, body?: unknown) => keres<T>(u, { method: 'PATCH', body }),
  del: <T>(u: string) => keres<T>(u, { method: 'DELETE' }),
};
