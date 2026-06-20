import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { OidcProvider, OidcKonfigHiba } from './oidc-provider.js';

const keres = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as unknown as FastifyRequest;

describe('OidcProvider', () => {
  it('Bearer token nélkül null (nem hitelesített)', async () => {
    const p = new OidcProvider({ verifikal: async () => ({}) });
    expect(await p.azonosit(keres())).toBeNull();
  });

  it('beadott verifikátorral feloldja az e-mailt a claimből', async () => {
    const p = new OidcProvider({
      verifikal: async () => ({ email: 'teszt@pelda.hu', sub: '123' }),
    });
    expect(await p.azonosit(keres('Bearer abc.def.ghi'))).toEqual({ email: 'teszt@pelda.hu' });
  });

  it('verifikátor nélkül, tokennel hibát dob (nem fogad el ellenőrizetlen tokent)', async () => {
    const p = new OidcProvider({});
    await expect(p.azonosit(keres('Bearer abc.def.ghi'))).rejects.toBeInstanceOf(OidcKonfigHiba);
  });

  it('egyedi emailClaim is használható', async () => {
    const p = new OidcProvider({
      emailClaim: 'preferred_username',
      verifikal: async () => ({ preferred_username: 'u@pelda.hu' }),
    });
    // A preferred_username névként is szolgál (name hiányában).
    expect(await p.azonosit(keres('Bearer x'))).toEqual({
      email: 'u@pelda.hu',
      nev: 'u@pelda.hu',
    });
  });
});
