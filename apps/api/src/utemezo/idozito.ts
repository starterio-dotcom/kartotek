import type { FastifyBaseLogger } from 'fastify';
import { UtemezoZar } from '../db/modellek.js';
import { config } from '../config.js';
import { utemezoFut } from './szolgaltatas.js';

/** A nap kulcsa (UTC, YYYY-MM-DD) — naponta egyszeri futás igényléséhez. */
function napKulcs(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Atomi nap-igénylés (elosztott zár): igaz, ha EZ a példány nyerte el az aznapi
 * futás jogát. Több példány/újraindulás mellett is pontosan egyszer fut naponta.
 */
export async function napIgenyel(ma: string): Promise<boolean> {
  try {
    const r = await UtemezoZar.updateOne(
      { _id: 'utemezo', utolsoFutasNap: { $ne: ma } },
      { $set: { utolsoFutasNap: ma, utoljaraModositva: new Date() } },
      { upsert: true },
    );
    return (r.upsertedCount ?? 0) > 0 || (r.modifiedCount ?? 0) > 0;
  } catch (e) {
    // Egyidejű párhuzamos upsert → a vesztes E11000-et kap (a nap már igényelve).
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

/** Egy ellenőrzési ciklus: ha ma még nem futott, igényli és lefuttatja az ütemezőt. */
async function tick(log: FastifyBaseLogger): Promise<void> {
  try {
    const ma = napKulcs();
    if (await napIgenyel(ma)) {
      const e = await utemezoFut();
      log.info({ ...e, nap: ma }, 'Ütemező automatikusan lefutott');
    }
  } catch (err) {
    log.error({ err }, 'Ütemező-ciklus hiba — a következő ellenőrzésnél újrapróbáljuk');
  }
}

/**
 * A szerveroldali ütemező elindítása: azonnal egy ciklus, majd időzítve ismétlés.
 * A dátumvezérelt állapotátmenetek (Jóváhagyott→Hatályos, Hatályos→Elavult) így
 * emberi beavatkozás nélkül végrehajtódnak. Leállító függvényt ad vissza.
 */
export function utemezoIndit(log: FastifyBaseLogger): () => void {
  if (!config.utemezoAktiv) {
    log.warn('Az automatikus ütemező ki van kapcsolva (UTEMEZO_AKTIV=false).');
    return () => {};
  }
  void tick(log);
  const timer = setInterval(() => void tick(log), config.utemezoIntervalMs);
  timer.unref?.();
  log.info({ intervalMs: config.utemezoIntervalMs }, 'Automatikus ütemező elindult');
  return () => clearInterval(timer);
}
