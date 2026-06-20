import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { FastifyRequest } from 'fastify';
import { jwksVerifikator } from './oidc-verifier.js';
import { OidcProvider } from './oidc-provider.js';

const ISSUER = 'https://idp.teszt/realms/kartotek';
const AUD = 'kartotek-web';
const KID = 'teszt-1';

let server: Server;
let jwksUri: string;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

beforeAll(async () => {
  const par = await generateKeyPair('RS256');
  privateKey = par.privateKey;
  const jwk = await exportJWK(par.publicKey);
  const test = { keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] };

  server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(test));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;
  jwksUri = `http://127.0.0.1:${port}/certs`;
});

afterAll(() => {
  server?.close();
});

async function token(claims: Record<string, unknown>, opts: { issuer?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

const keres = (authorization: string) =>
  ({ headers: { authorization } }) as unknown as FastifyRequest;

describe('jwksVerifikator (valós JWKS-fetch)', () => {
  it('érvényes, aláírt tokent elfogad és visszaadja a claimeket', async () => {
    const v = jwksVerifikator({ issuer: ISSUER, jwksUri, audience: AUD });
    const t = await token({ email: 'kiss.anna@pelda.hu', name: 'Kiss Anna' });
    const payload = await v(t);
    expect(payload.email).toBe('kiss.anna@pelda.hu');
  });

  it('rossz issuer-t elutasít', async () => {
    const v = jwksVerifikator({ issuer: ISSUER, jwksUri, audience: AUD });
    const t = await token({ email: 'x@pelda.hu' }, { issuer: 'https://gonosz.idp' });
    await expect(v(t)).rejects.toBeTruthy();
  });
});

describe('OidcProvider + jwksVerifikator', () => {
  it('a Bearer tokenből feloldja az e-mailt és a nevet', async () => {
    const p = new OidcProvider({
      issuer: ISSUER,
      audience: AUD,
      verifikal: jwksVerifikator({ issuer: ISSUER, jwksUri, audience: AUD }),
    });
    const t = await token({ email: 'nagy.peter@pelda.hu', name: 'Nagy Péter' });
    expect(await p.azonosit(keres(`Bearer ${t}`))).toEqual({
      email: 'nagy.peter@pelda.hu',
      nev: 'Nagy Péter',
    });
  });

  it('hamis aláírású tokenre null-t ad (nem hitelesített → 401, nem 500)', async () => {
    const masik = await generateKeyPair('RS256');
    const hamis = await new SignJWT({ email: 'x@pelda.hu' })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer(ISSUER)
      .setAudience(AUD)
      .setExpirationTime('5m')
      .sign(masik.privateKey);
    const p = new OidcProvider({
      issuer: ISSUER,
      audience: AUD,
      verifikal: jwksVerifikator({ issuer: ISSUER, jwksUri, audience: AUD }),
    });
    expect(await p.azonosit(keres(`Bearer ${hamis}`))).toBeNull();
  });
});
