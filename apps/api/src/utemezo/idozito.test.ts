import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { napIgenyel } from './idozito.js';
import { UtemezoZar } from '../db/modellek.js';

let replset: MongoMemoryReplSet;

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri(), { directConnection: true });
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replset?.stop();
});

describe('ütemező elosztott zár (napIgenyel)', () => {
  it('egy napra pontosan egyszer ad futási jogot', async () => {
    await UtemezoZar.deleteMany({});
    const ma = '2026-09-25';

    // Első igénylés nyer (upsert), a második ugyanarra a napra veszít.
    expect(await napIgenyel(ma)).toBe(true);
    expect(await napIgenyel(ma)).toBe(false);
    expect(await napIgenyel(ma)).toBe(false);

    // Új nap → újra nyerhető.
    expect(await napIgenyel('2026-09-26')).toBe(true);
    expect(await napIgenyel('2026-09-26')).toBe(false);
  });

  it('párhuzamos igénylésből legfeljebb egy nyer', async () => {
    await UtemezoZar.deleteMany({});
    const nap = '2026-10-01';
    const eredmenyek = await Promise.all(
      Array.from({ length: 8 }, () => napIgenyel(nap)),
    );
    expect(eredmenyek.filter(Boolean)).toHaveLength(1);
  });
});
