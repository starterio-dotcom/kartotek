import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface BiztonsagOpciok {
  /** Rate-limit, IP-szint (hitelesítés előtt): max kérés / ablak egy IP-ről. 0 = ki. */
  rateLimitMax?: number;
  /** Rate-limit, felhasználó-szint (hitelesítés után): max kérés / ablak felhasználónként. 0 = ki. */
  rateLimitFelhasznaloMax?: number;
  /** A rate-limit időablaka ezredmásodpercben. */
  rateLimitAblakMs?: number;
  /** Éles mód: szigorúbb HSTS. */
  eles?: boolean;
  /** Óra (teszteléshez befecskendezhető). */
  ora?: () => number;
}

/** Csúszó ablakos számláló (két-vödrös közelítés): nincs 2× burst az ablakhatáron. */
export function csuszoAblak(max: number, ablakMs: number) {
  const vodrok = new Map<string, { kezdet: number; akt: number; elozo: number }>();
  return {
    /** Igényel egy kérést a kulcsra; ha a becsült terhelés elérte a max-ot, visszautasít. */
    probal(kulcs: string, most: number): { engedve: true } | { engedve: false; visszaSec: number } {
      const kezdet = Math.floor(most / ablakMs) * ablakMs;
      let v = vodrok.get(kulcs);
      if (!v || v.kezdet !== kezdet) {
        // Új ablak: az előző ablak számát csak akkor visszük át, ha közvetlenül megelőzte.
        const elozo = v && v.kezdet === kezdet - ablakMs ? v.akt : 0;
        v = { kezdet, akt: 0, elozo };
        vodrok.set(kulcs, v);
      }
      // Az előző ablak súlya lineárisan csökken, ahogy haladunk az aktuálisban.
      const becsult = v.akt + v.elozo * (1 - (most - kezdet) / ablakMs);
      if (becsult >= max) {
        return { engedve: false, visszaSec: Math.max(1, Math.ceil((kezdet + ablakMs - most) / 1000)) };
      }
      v.akt += 1;
      return { engedve: true };
    },
    /** A két ablaknál régebbi vödrök eldobása (memória). */
    takarit(most: number): void {
      for (const [k, v] of vodrok) if (v.kezdet < most - 2 * ablakMs) vodrok.delete(k);
    },
    meret: () => vodrok.size,
  };
}

/** Az életjel nincs korlátozva (monitorozás). */
function korlatlan(url: string): boolean {
  return url === '/health' || url.startsWith('/health?');
}

/**
 * Könnyű, függőség nélküli biztonsági réteg:
 *  - biztonsági válaszfejlécek minden válaszra (XSS-/clickjacking-/MIME-védelem),
 *  - kétszintű, csúszó ablakos rate limiting:
 *      1) IP-szint az `onRequest`-ben, a hitelesítés ELŐTT — elutasításkor a hitelesítés
 *         DB-lekérdezése le sem fut (a DB védelme). Helyes IP-hez `trustProxy` kell.
 *      2) felhasználó-szint a `preHandler`-ben, a hitelesítés UTÁN — egy felhasználó
 *         ne terhelhesse túl a rendszert egy közös (NAT-olt) IP-n osztozók rovására.
 *
 * A számlálók folyamaton belüliek: több API-példánynál elosztott tárolás (pl. Redis)
 * kell; egy példányos telepítéshez ez külső függőség nélkül pontos.
 */
export const biztonsagPlugin = fp<BiztonsagOpciok>(async (app: FastifyInstance, opts) => {
  const max = opts.rateLimitMax ?? 1200;
  const felhMax = opts.rateLimitFelhasznaloMax ?? 0;
  const ablakMs = opts.rateLimitAblakMs ?? 60_000;
  const ora = opts.ora ?? Date.now;

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

  const elutasit = (reply: FastifyReply, visszaSec: number) =>
    reply
      .header('Retry-After', String(visszaSec))
      .code(429)
      .send({ hiba: 'Túl sok kérés — próbáld újra később.' });

  const ipKorlat = max > 0 ? csuszoAblak(max, ablakMs) : null;
  const felhKorlat = felhMax > 0 ? csuszoAblak(felhMax, ablakMs) : null;

  if (ipKorlat || felhKorlat) {
    // Időnként takarítjuk a régi vödröket (nem blokkolja a leállást).
    const takarito = setInterval(() => {
      const most = ora();
      ipKorlat?.takarit(most);
      felhKorlat?.takarit(most);
    }, ablakMs);
    takarito.unref?.();
    app.addHook('onClose', async () => clearInterval(takarito));
  }

  // 1) IP-szint — a hitelesítés (és annak DB-lekérdezése) ELŐTT.
  if (ipKorlat) {
    app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
      if (korlatlan(req.url)) return;
      const r = ipKorlat.probal(`ip:${req.ip}`, ora());
      // Korai válasz async hookból: `return reply` állítja meg a további hookokat.
      if (!r.engedve) return elutasit(reply, r.visszaSec);
    });
  }

  // 2) Felhasználó-szint — a hitelesítés UTÁN (a preHandler már látja a felhasználót).
  if (felhKorlat) {
    app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
      if (korlatlan(req.url) || !req.felhasznalo) return;
      const r = felhKorlat.probal(`u:${req.felhasznalo.id}`, ora());
      if (!r.engedve) return elutasit(reply, r.visszaSec);
    });
  }
});
