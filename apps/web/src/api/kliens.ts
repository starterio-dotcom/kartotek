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

async function keres<T>(
  utvonal: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const fejlec: Record<string, string> = { ...authFejlec() };
  if (opts.body !== undefined) fejlec['content-type'] = 'application/json';

  const res = await fetch(`${API_URL}${utvonal}`, {
    method: opts.method ?? 'GET',
    headers: fejlec,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const szoveg = await res.text();
  const adat = szoveg ? JSON.parse(szoveg) : undefined;
  if (!res.ok) {
    const uzenet = (adat && (adat.hiba as string)) || `Hiba (${res.status})`;
    throw new ApiHiba(res.status, uzenet, adat?.reszletek);
  }
  return adat as T;
}

/** Nyers (bináris) lekérés a melléklet-tartalomhoz — a dev-fejléccel együtt. */
export async function tartalomFetch(utvonal: string): Promise<Response> {
  return fetch(`${API_URL}${utvonal}`, { headers: { ...authFejlec() } });
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

  const res = await fetch(`${API_URL}${utvonal}`, { method: 'POST', headers: fejlec, body: form });
  const szoveg = await res.text();
  const adat = szoveg ? JSON.parse(szoveg) : undefined;
  if (!res.ok) throw new ApiHiba(res.status, (adat && adat.hiba) || `Hiba (${res.status})`, adat?.reszletek);
  return adat as T;
}

export const api = {
  get: <T>(u: string) => keres<T>(u),
  post: <T>(u: string, body?: unknown) => keres<T>(u, { method: 'POST', body }),
  patch: <T>(u: string, body?: unknown) => keres<T>(u, { method: 'PATCH', body }),
  del: <T>(u: string) => keres<T>(u, { method: 'DELETE' }),
};
