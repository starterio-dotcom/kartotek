import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface BiztonsagOpciok {
  /** Rate-limit: max kérés / ablak egy klienstől. 0 = kikapcsolva. */
  rateLimitMax?: number;
  /** A rate-limit időablaka ezredmásodpercben. */
  rateLimitAblakMs?: number;
  /** Éles mód: szigorúbb HSTS. */
  eles?: boolean;
}

/**
 * Könnyű, függőség nélküli biztonsági réteg (Fázis 7):
 *  - biztonsági válaszfejlécek minden válaszra (XSS-/clickjacking-/MIME-védelem),
 *  - egyszerű, memóriában tartott IP-alapú rate limiting az írási terhelés ellen.
 *
 * Éles, elosztott üzemben dedikált megoldás (pl. @fastify/helmet + Redis-alapú
 * @fastify/rate-limit, vagy API-gateway) ajánlott; ez a varrat ugyanazokat a
 * fejléceket és viselkedést adja egy node-os telepítéshez, külső függőség nélkül.
 */
export const biztonsagPlugin = fp<BiztonsagOpciok>(async (app: FastifyInstance, opts) => {
  const max = opts.rateLimitMax ?? 300;
  const ablakMs = opts.rateLimitAblakMs ?? 60_000;

  // --- Biztonsági fejlécek ---
  app.addHook('onSend', async (_req: FastifyRequest, reply: FastifyReply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    );
    if (opts.eles)
      reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    return payload;
  });

  // --- Rate limiting (memóriában, csúszó számláló ablakkal) ---
  if (max > 0) {
    const szamlalok = new Map<string, { db: number; lejar: number }>();

    // Időnként takarítjuk a lejárt bejegyzéseket (nem blokkolja a leállást).
    const takarito = setInterval(() => {
      const most = Date.now();
      for (const [k, v] of szamlalok) if (v.lejar <= most) szamlalok.delete(k);
    }, ablakMs);
    takarito.unref?.();
    app.addHook('onClose', async () => clearInterval(takarito));

    app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
      // Az életjel és a dokumentáció nincs korlátozva.
      if (req.url === '/health' || req.url.startsWith('/dok')) return;
      const kulcs = req.ip;
      const most = Date.now();
      const akt = szamlalok.get(kulcs);
      if (!akt || akt.lejar <= most) {
        szamlalok.set(kulcs, { db: 1, lejar: most + ablakMs });
      } else {
        akt.db += 1;
        if (akt.db > max) {
          const visszaSec = Math.ceil((akt.lejar - most) / 1000);
          reply
            .header('Retry-After', String(visszaSec))
            .code(429)
            .send({ hiba: 'Túl sok kérés — próbáld újra később.' });
        }
      }
    });
  }
});
