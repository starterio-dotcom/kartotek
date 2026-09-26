import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { biztonsagPlugin } from './plugin.js';

let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
});

async function epit(opts = {}): Promise<FastifyInstance> {
  app = Fastify();
  await app.register(biztonsagPlugin, opts);
  app.get('/x', async () => ({ ok: true }));
  app.get('/health', async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('biztonsági fejlécek', () => {
  it('minden válaszon ott vannak a védő fejlécek', async () => {
    await epit({ rateLimitMax: 0 });
    const res = await app.inject({ method: 'GET', url: '/x' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['permissions-policy']).toContain('geolocation=()');
  });

  it('éles módban HSTS-fejléc is van', async () => {
    await epit({ rateLimitMax: 0, eles: true });
    const res = await app.inject({ method: 'GET', url: '/x' });
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });
});

describe('rate limiting', () => {
  it('a limit felett 429-et ad Retry-After fejléccel', async () => {
    await epit({ rateLimitMax: 2, rateLimitAblakMs: 60_000 });
    expect((await app.inject({ method: 'GET', url: '/x' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/x' })).statusCode).toBe(200);
    const harmadik = await app.inject({ method: 'GET', url: '/x' });
    expect(harmadik.statusCode).toBe(429);
    expect(harmadik.headers['retry-after']).toBeDefined();
  });

  it('a /health nincs korlátozva', async () => {
    await epit({ rateLimitMax: 1, rateLimitAblakMs: 60_000 });
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('csúszó ablak: az ablakhatáron nincs 2× burst', async () => {
    let t = 0;
    await epit({ rateLimitMax: 10, rateLimitAblakMs: 1000, ora: () => t });
    const hivas = async () => (await app.inject({ method: 'GET', url: '/x' })).statusCode;
    for (let i = 0; i < 10; i++) expect(await hivas()).toBe(200);
    expect(await hivas()).toBe(429);
    // A következő ablak felénél az előző ablak fele még "számít": csak 5 fér bele,
    // nem 10 (a fix ablak itt újabb 10-et engedne → 20 kérés ~1 mp alatt).
    t = 1500;
    let engedve = 0;
    while ((await hivas()) === 200) engedve++;
    expect(engedve).toBe(5);
  });

  it('a 429 megállítja a későbbi onRequest hookokat (a hitelesítés DB-lekérdezése nem fut)', async () => {
    app = Fastify();
    await app.register(biztonsagPlugin, { rateLimitMax: 1, rateLimitAblakMs: 60_000 });
    let authFutott = 0;
    app.addHook('onRequest', async () => {
      authFutott++; // a valódi authPlugin itt kérdezné le a felhasználót a DB-ből
    });
    app.get('/x', async () => ({ ok: true }));
    await app.ready();
    expect((await app.inject({ method: 'GET', url: '/x' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/x' })).statusCode).toBe(429);
    expect(authFutott).toBe(1);
  });

  it('trustProxy mellett az X-Forwarded-For szerinti kliens-IP a kulcs', async () => {
    app = Fastify({ trustProxy: true });
    await app.register(biztonsagPlugin, { rateLimitMax: 1, rateLimitAblakMs: 60_000 });
    app.get('/x', async () => ({ ok: true }));
    await app.ready();
    const hiv = (ip: string) =>
      app.inject({ method: 'GET', url: '/x', headers: { 'x-forwarded-for': ip } });
    expect((await hiv('10.0.0.1')).statusCode).toBe(200);
    expect((await hiv('10.0.0.2')).statusCode).toBe(200); // külön kliens, külön vödör
    expect((await hiv('10.0.0.1')).statusCode).toBe(429);
  });

  it('felhasználó-szint: egy felhasználó kimerülése nem érinti a többit', async () => {
    app = Fastify();
    await app.register(biztonsagPlugin, {
      rateLimitMax: 0,
      rateLimitFelhasznaloMax: 2,
      rateLimitAblakMs: 60_000,
    });
    // A valódi authPlugin szerepét játsszuk: fejléc → req.felhasznalo.
    app.addHook('onRequest', async (req) => {
      const u = req.headers['x-u'];
      if (typeof u === 'string') (req as { felhasznalo?: unknown }).felhasznalo = { id: u };
    });
    app.get('/x', async () => ({ ok: true }));
    await app.ready();
    const hiv = (u: string) => app.inject({ method: 'GET', url: '/x', headers: { 'x-u': u } });
    expect((await hiv('anna')).statusCode).toBe(200);
    expect((await hiv('anna')).statusCode).toBe(200);
    expect((await hiv('anna')).statusCode).toBe(429);
    expect((await hiv('peter')).statusCode).toBe(200); // ugyanarról az IP-ről, más felhasználó
  });
});
