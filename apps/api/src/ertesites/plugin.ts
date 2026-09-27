import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { kuldoKonfigbol, type EmailKuldo } from './email.js';
import { ertesitesKeszit, type EsemenyBe } from './szolgaltatas.js';

declare module 'fastify' {
  interface FastifyInstance {
    ertesito: {
      /** Esemény kiváltása: nem blokkolja a választ, a hiba nem dönti el a műveletet. */
      esemeny: (be: EsemenyBe) => void;
      /** A függőben lévő értesítések bevárása (tesztek, leállás). */
      flush: () => Promise<void>;
    };
  }
}

export interface ErtesitesOpciok {
  /** E-mail csatorna felülírása (tesztekhez); alapból a konfigurációból. */
  kuldo?: EmailKuldo;
}

export const ertesitesPlugin = fp<ErtesitesOpciok>(async (app: FastifyInstance, opts) => {
  const kuldo = opts.kuldo ?? kuldoKonfigbol(app.log);
  const fuggoben = new Set<Promise<unknown>>();

  app.decorate('ertesito', {
    esemeny(be: EsemenyBe) {
      const p: Promise<unknown> = ertesitesKeszit(be, kuldo, app.log)
        .catch((err: unknown) => app.log.error({ err }, 'Értesítés-kézbesítési hiba'))
        .finally(() => fuggoben.delete(p));
      fuggoben.add(p);
    },
    async flush() {
      await Promise.all([...fuggoben]);
    },
  });
  app.addHook('onClose', async () => {
    await Promise.all([...fuggoben]);
  });
});
