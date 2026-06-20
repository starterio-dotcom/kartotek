import type { FastifyRequest } from 'fastify';
import type { AuthProvider, Identitas } from './provider.js';

export interface OidcOpciok {
  issuer?: string;
  audience?: string;
  /** Melyik claimből jön az e-mail (alapból `email`). */
  emailClaim?: string;
  /**
   * A token aláírás-ellenőrzése. ÉLESBEN KÖTELEZŐ megadni (pl. `jose`
   * `createRemoteJWKSet` + `jwtVerify` a JWKS-URI-ra). A varrat szándékosan
   * NEM dekódol ellenőrzés nélkül: ha nincs verifikátor, a kérés elutasul.
   */
  verifikal?: (token: string) => Promise<Record<string, unknown>>;
}

/**
 * OIDC/SSO hitelesítési provider az auth-varraton (Fázis 7). A `Bearer` tokent
 * a beadott `verifikal` függvénnyel ellenőrzi (JWKS aláírás-validáció), majd a
 * kívánt claimből oldja fel az e-mailt — innen a meglévő DB-feloldás változatlan.
 *
 * Bekötés éles környezetben:
 *   1) telepíts egy JWKS-validátort (pl. `jose`),
 *   2) add át `verifikal`-ként a `jwtVerify`-t az `OIDC_ISSUER`/`OIDC_JWKS_URI`/
 *      `OIDC_AUDIENCE` konfigurációval,
 *   3) `AUTH_PROVIDER=oidc`.
 * A route-ok és service-ek érintetlenek maradnak (a varrat lényege).
 */
export class OidcProvider implements AuthProvider {
  constructor(private readonly opts: OidcOpciok) {}

  async azonosit(req: FastifyRequest): Promise<Identitas | null> {
    const fejlec = req.headers.authorization;
    if (!fejlec || !fejlec.toLowerCase().startsWith('bearer ')) return null;
    const token = fejlec.slice(7).trim();
    if (!token) return null;

    if (!this.opts.verifikal) {
      throw new OidcKonfigHiba(
        'OIDC ki van választva, de nincs token-ellenőrző (verifikal) beállítva — ' +
          'éles üzemhez JWKS aláírás-validáció szükséges.',
      );
    }

    let claims: Record<string, unknown>;
    try {
      claims = await this.opts.verifikal(token);
    } catch {
      // Érvénytelen / lejárt / hamis aláírású token → NEM hitelesített (401), nem 500.
      return null;
    }
    const claim = this.opts.emailClaim ?? 'email';
    const email = claims[claim];
    if (typeof email !== 'string' || !email) return null;
    const nev = claims.name ?? claims.preferred_username;
    return { email, ...(typeof nev === 'string' && nev ? { nev } : {}) };
  }
}

/** 501: a varrat ki van választva, de nincs teljesen bekötve (lásd OidcProvider). */
export class OidcKonfigHiba extends Error {
  statusCode = 501;
  constructor(message: string) {
    super(message);
    this.name = 'AppHiba';
  }
}
