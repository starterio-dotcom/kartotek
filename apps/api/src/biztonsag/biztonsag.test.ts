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
});
