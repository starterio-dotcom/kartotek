import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

/** Alkalmazás-szintű, HTTP-státuszt hordozó hiba. */
export class AppHiba extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public reszletek?: unknown,
  ) {
    super(message);
    this.name = 'AppHiba';
  }
}

export const hiba400 = (uzenet: string, reszletek?: unknown) => new AppHiba(400, uzenet, reszletek);
export const hiba403 = (uzenet = 'Nincs jogosultság') => new AppHiba(403, uzenet);
export const hiba404 = (uzenet = 'Nem található') => new AppHiba(404, uzenet);
export const hiba409 = (uzenet: string, reszletek?: unknown) => new AppHiba(409, uzenet, reszletek);

/** Egységes hibakezelő: AppHiba, Zod-validáció és MongoDB-duplikátum kezelése. */
export function hibakezeloRegisztracio(app: FastifyInstance): void {
  app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown; code?: string }, _req, reply) => {
    if (error instanceof AppHiba) {
      return reply.code(error.statusCode).send({ hiba: error.message, reszletek: error.reszletek });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({ hiba: 'Érvénytelen bemenet', reszletek: error.issues });
    }
    // Fastify séma-validációs hiba (validatorCompiler ZodError-t csomagol).
    if (error.validation) {
      return reply.code(400).send({ hiba: 'Érvénytelen bemenet', reszletek: error.validation });
    }
    if (error.code === '11000') {
      return reply.code(409).send({ hiba: 'Ütköző egyedi érték (duplikátum)' });
    }
    const code = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (code === 500) app.log.error(error);
    return reply.code(code).send({ hiba: code === 500 ? 'Belső hiba' : error.message });
  });
}
