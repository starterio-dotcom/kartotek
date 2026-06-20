import { csatlakozasDb, bontasDb } from '../db/mongoose.js';
import { seedAdatbazis } from './seed.js';

/** CLI: `pnpm --filter @kartotek/api seed` — betölti a példaadatokat az élő DB-be. */
async function fo(): Promise<void> {
  await csatlakozasDb();
  const e = await seedAdatbazis();
  console.log('Seed kész:', e);
  await bontasDb();
}

fo().catch((err) => {
  console.error('Seed hiba:', err);
  process.exit(1);
});
