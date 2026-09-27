import type { FastifyBaseLogger } from 'fastify';
import { Elem } from './modellek.js';

/**
 * Kereső-szöveg pótlása a mező bevezetése előtt mentett verziókhoz (idempotens).
 * Csak azokat az elemeket tölti be, amelyeknek van `keresoSzoveg` nélküli verziója;
 * a mentést a pre('validate') hook számolja ki. Párhuzamos módosításnál (optimista
 * zár) az adott elem kimarad — a következő induláskor, vagy bármely mentésnél pótlódik.
 */
export async function keresoSzovegPotlas(log: FastifyBaseLogger): Promise<number> {
  const jeloltek = await Elem.find({ verziok: { $elemMatch: { keresoSzoveg: { $exists: false } } } })
    .select('_id')
    .lean();
  let potolt = 0;
  for (const { _id } of jeloltek) {
    try {
      const elem = await Elem.findById(_id);
      if (!elem) continue;
      // A hidratált dokumentumban a hiányzó mező alapértéke ''; a hook ezt írja felül.
      for (let i = 0; i < elem.verziok.length; i++) elem.markModified(`verziok.${i}.keresoSzoveg`);
      await elem.save();
      potolt++;
    } catch (err) {
      log.warn({ err, elemId: String(_id) }, 'Kereső-szöveg pótlás kimaradt (később pótlódik)');
    }
  }
  if (potolt) log.info({ potolt }, 'Kereső-szöveg pótolva');
  return potolt;
}
