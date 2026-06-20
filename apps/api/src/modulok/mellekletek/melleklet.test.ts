import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import FormData from 'form-data';
import { buildApp } from '../../app.js';
import { seedAdatbazis } from '../../seed/seed.js';
import { LemezTarhely } from '../../tarhely/tarhely.js';

let replset: MongoMemoryReplSet;
let app: FastifyInstance;
let tarhelyDir: string;

const ANNA = 'kiss.anna@pelda.hu';
const PETER = 'nagy.peter@pelda.hu';

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri(), { directConnection: true });
  tarhelyDir = await mkdtemp(join(tmpdir(), 'kartotek-tarhely-'));
  app = await buildApp({ tarhely: new LemezTarhely(tarhelyDir) });
  await app.ready();
  await seedAdatbazis();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await mongoose.disconnect();
  await replset?.stop();
  if (tarhelyDir) await rm(tarhelyDir, { recursive: true, force: true });
});

function hiv(method: 'GET' | 'POST' | 'DELETE', url: string, mint: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: mint ? { 'x-felhasznalo-email': mint } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
}

async function feltolt(url: string, mint: string, buffer: Buffer, fajlNev: string, mime: string, mezok: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', buffer, { filename: fajlNev, contentType: mime });
  for (const [k, v] of Object.entries(mezok)) form.append(k, v);
  return app.inject({
    method: 'POST',
    url,
    headers: { ...form.getHeaders(), 'x-felhasznalo-email': mint },
    payload: form.getBuffer(),
  });
}

async function ujVazlat(): Promise<string> {
  const res = await hiv('POST', '/api/elemek', ANNA, {
    alkalmazasKod: '3R',
    tipusKod: 'BUS',
    cim: 'Melléklet-teszt',
    leirasMd: 'x',
  });
  return res.json().id as string;
}

const CSV = 'mezo,tipus\nid,uuid\nnev,string';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic

describe('mellékletek', () => {
  it('CSV feltölthető, kiszolgálható és törölhető', async () => {
    const id = await ujVazlat();
    const fel = await feltolt(`/api/elemek/${id}/verziok/1/mellekletek`, ANNA, Buffer.from(CSV), 'mezok.csv', 'text/csv');
    expect(fel.statusCode).toBe(201);
    const m = fel.json().verziok[0].mellekletek[0];
    expect(m.tipus).toBe('csv');

    const tart = await hiv('GET', `/api/elemek/${id}/verziok/1/mellekletek/${m.mid}/tartalom`, ANNA);
    expect(tart.statusCode).toBe(200);
    expect(tart.headers['content-type']).toContain('text/csv');
    expect(tart.body).toBe(CSV);

    const torol = await hiv('DELETE', `/api/elemek/${id}/verziok/1/mellekletek/${m.mid}`, ANNA);
    expect(torol.statusCode).toBe(200);
    expect(torol.json().verziok[0].mellekletek).toHaveLength(0);
  });

  it('kép feltöltése kép típusként', async () => {
    const id = await ujVazlat();
    const fel = await feltolt(`/api/elemek/${id}/verziok/1/mellekletek`, ANNA, PNG, 'kep.png', 'image/png');
    expect(fel.statusCode).toBe(201);
    expect(fel.json().verziok[0].mellekletek[0].tipus).toBe('kep');
  });

  it('videó feltöltése videó típusként', async () => {
    const id = await ujVazlat();
    const fel = await feltolt(`/api/elemek/${id}/verziok/1/mellekletek`, ANNA, Buffer.from([0, 1, 2]), 'klip.mp4', 'video/mp4');
    expect(fel.statusCode).toBe(201);
    expect(fel.json().verziok[0].mellekletek[0].tipus).toBe('video');
  });

  it('Figma-keret pillanatképpel (figmaLink mező)', async () => {
    const id = await ujVazlat();
    const link = 'https://www.figma.com/design/X/Y?node-id=297%3A4125';
    const fel = await feltolt(`/api/elemek/${id}/verziok/1/mellekletek`, ANNA, PNG, 'frame.png', 'image/png', { figmaLink: link });
    expect(fel.statusCode).toBe(201);
    const m = fel.json().verziok[0].mellekletek[0];
    expect(m.tipus).toBe('figma');
    expect(m.figmaLink).toContain('node-id=297%3A4125');
  });

  it('Figma élő link pillanatkép nélkül (JSON végpont)', async () => {
    const id = await ujVazlat();
    const res = await hiv('POST', `/api/elemek/${id}/verziok/1/mellekletek/figma`, ANNA, {
      alt: 'Élő terv',
      figmaLink: 'https://www.figma.com/design/X/Y?node-id=12%3A34',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().verziok[0].mellekletek[0].tipus).toBe('figma');
  });

  it('Hatályossá vált verzióra nem tölthető fel (befagyott) és fagyasztva beáll', async () => {
    const id = await ujVazlat();
    await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, ANNA);
    await hiv('POST', `/api/elemek/${id}/verziok/1/jovahagyas`, PETER, { hatalyKezdet: '2026-07-01' });
    await hiv('POST', '/api/utemezo/futtat', PETER, { ma: '2026-07-02' });

    const elem = await hiv('GET', `/api/elemek/${id}`, ANNA);
    const v1 = elem.json().verziok[0];
    expect(v1.statusz).toBe('Hatályos');
    expect(v1.fagyasztva).toBeTruthy();

    const fel = await feltolt(`/api/elemek/${id}/verziok/1/mellekletek`, ANNA, Buffer.from(CSV), 'x.csv', 'text/csv');
    expect(fel.statusCode).toBe(409);
  });
});
