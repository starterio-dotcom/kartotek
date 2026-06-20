import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { seedAdatbazis } from './seed.js';
import { Elem, Kapcsolat, Felhasznalo } from '../db/modellek.js';

let replset: MongoMemoryReplSet;

beforeAll(async () => {
  // Egy-node-os replica set — a több-dokumentumos tranzakciókhoz kell.
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri(), { directConnection: true });
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replset?.stop();
});

describe('seed + Mongoose-modellek', () => {
  it('betölti a prototípus példaadatait a várt darabszámmal', async () => {
    const e = await seedAdatbazis();
    expect(e).toEqual({
      felhasznalok: 5,
      szolgaltatasok: 1,
      alkalmazasok: 2,
      szabalyzatok: 1,
      elemek: 9,
      kapcsolatok: 10,
    });
    expect(await Elem.countDocuments()).toBe(9);
    expect(await Kapcsolat.countDocuments()).toBe(10);
  });

  it('a beágyazott verziók, napló és melléklet helyesen tárolódnak', async () => {
    const bus002 = await Elem.findOne({ kulcs: '3R-BUS-002' }).lean();
    expect(bus002?.verziok).toHaveLength(2);
    const v1 = bus002!.verziok[0]!;
    expect(v1.statusz).toBe('Hatályos');
    expect(v1.statusznaplo.length).toBeGreaterThan(0);
    // A létrehozási bejegyzésnek nincs honnan-ja, az automata átmenet ki=RENDSZER.
    expect(v1.statusznaplo[0]!.honnan).toBeUndefined();
    expect(v1.statusznaplo.some((n) => n.ki === 'RENDSZER')).toBe(true);

    // A Figma élő link helyesen URL-kódolt node-id-vel (297%3A4125) őrződik meg.
    const v2 = bus002!.verziok[1]!;
    const figma = v2.mellekletek.find((m) => m.tipus === 'figma');
    expect(figma?.figmaLink).toContain('node-id=297%3A4125');
  });

  it('az alkalmazáskód a kulcsból helyesen származik (Terminus is)', async () => {
    const term = await Elem.findOne({ kulcs: 'Terminus-TDB-TD-001' }).lean();
    expect(term?.alkalmazasKod).toBe('Terminus');
    expect(term?.retegKod).toBe('TDB');
    const busi = await Elem.findOne({ kulcs: '3R-BUS-001' }).lean();
    expect(busi?.alkalmazasKod).toBe('3R');
    expect(busi?.retegKod).toBeNull();
  });

  it('a megfelel kapcsolat célja szabályzat-kód, nem elem', async () => {
    const megfelel = await Kapcsolat.findOne({ fajta: 'megfelel' }).lean();
    expect(megfelel?.celSzabalyzatKod).toBe('IB-XYT-14-1213');
    expect(megfelel?.celElemId).toBeNull();
  });

  it('a kulcs egyedi indexe tiltja a duplikátumot', async () => {
    await Elem.init(); // indexek felépítése
    await expect(
      Elem.create({ kulcs: '3R-BUS-001', tipusKod: 'BUS', alkalmazasKod: '3R' }),
    ).rejects.toThrow();
  });

  it('a felhasználói tagságok alkalmazásra szabottak', async () => {
    const anna = await Felhasznalo.findOne({ nev: 'Kiss Anna' }).lean();
    expect(anna?.tagsagok).toEqual([{ alkalmazasKod: '3R', szerepkor: 'Szerző' }]);
    const peter = await Felhasznalo.findOne({ nev: 'Nagy Péter' }).lean();
    expect(peter?.globalisAdmin).toBe(true);
  });

  it('több-dokumentumos tranzakció működik (replica set)', async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Kapcsolat.create(
          [{ forrasElemId: new mongoose.Types.ObjectId(), celKulsoLink: 'https://x.hu', fajta: 'hivatkozik' }],
          { session },
        );
        await Elem.updateOne(
          { kulcs: '3R-FE-TUS-002' },
          { $set: { 'verziok.0.statusz': 'Véleményezés' } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    const fe = await Elem.findOne({ kulcs: '3R-FE-TUS-002' }).lean();
    expect(fe?.verziok[0]!.statusz).toBe('Véleményezés');
    expect(await Kapcsolat.countDocuments()).toBe(11);
  });
});
