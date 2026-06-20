import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('200-at ad statusz=ok-kal és DB-állapottal', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.statusz).toBe('ok');
    expect(typeof body.db.readyState).toBe('number');
    expect(typeof body.db.csatlakozva).toBe('boolean');
  });
});
