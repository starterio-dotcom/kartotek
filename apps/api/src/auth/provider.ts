import type { FastifyRequest } from 'fastify';

/** Egy kérésből kinyert nyers identitás (a felhasználót még a DB-ből oldjuk fel). */
export interface Identitas {
  email?: string;
  id?: string;
  /** Megjelenítési név (OIDC), az auto-provisioninghoz. */
  nev?: string;
}

/**
 * Hitelesítési varrat: a domain-kód nem tudja, honnan jön az identitás.
 * Később OIDC/SSO-provider cserélhető be a helyi/dev provider helyett (Fázis 7),
 * a route-ok és a service-ek változatlanok maradnak.
 */
export interface AuthProvider {
  azonosit(req: FastifyRequest): Promise<Identitas | null>;
}

/**
 * Fejléc-alapú dev provider: a kliens az `x-felhasznalo-email` (vagy `x-felhasznalo-id`)
 * fejlécben jelzi, ki ő. CSAK fejlesztéshez/teszthez — éles helyett OIDC jön.
 */
export class DevFejlecProvider implements AuthProvider {
  async azonosit(req: FastifyRequest): Promise<Identitas | null> {
    const email = req.headers['x-felhasznalo-email'];
    const id = req.headers['x-felhasznalo-id'];
    if (typeof email === 'string' && email) return { email };
    if (typeof id === 'string' && id) return { id };
    return null;
  }
}
