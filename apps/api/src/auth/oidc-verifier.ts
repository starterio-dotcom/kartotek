import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface JwksVerifikatorOpciok {
  /** Az IdP issuer-e (a token `iss` ellenőrzéséhez). */
  issuer: string;
  /** A JWKS végpont (az aláíró kulcsokhoz). */
  jwksUri: string;
  /** Opcionális audience (`aud`) ellenőrzés. */
  audience?: string;
}

/**
 * JWKS-alapú token-ellenőrző (Fázis 8). Az IdP nyilvános kulcsait a JWKS-URI-ról
 * tölti (gyorsítótárazva, kulcsrotációval), és aláírást + `iss`(+`aud`) lejáratot
 * validál. Ezt adjuk be az `OidcProvider`-nek `verifikal`-ként — innen a meglévő
 * e-mail-claim → DB-feloldás változatlan. IdP-agnosztikus (Keycloak/Google/DÁP…).
 */
export function jwksVerifikator(opts: JwksVerifikatorOpciok): (token: string) => Promise<JWTPayload> {
  const JWKS = createRemoteJWKSet(new URL(opts.jwksUri));
  return async (token: string): Promise<JWTPayload> => {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: opts.issuer,
      ...(opts.audience ? { audience: opts.audience } : {}),
    });
    return payload;
  };
}
