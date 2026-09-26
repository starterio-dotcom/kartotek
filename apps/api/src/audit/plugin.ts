import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuditBejegyzes } from '../db/modellek.js';
import { dbAllapot } from '../db/mongoose.js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** A függőben lévő audit-írások bevárása (tesztek, leállás). */
    auditFlush: () => Promise<void>;
  }
}

export type AuditEsemeny = 'modositas' | 'hozzaferes-megtagadva' | 'olvasas';

const MODOSITO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Érzékeny olvasások: ki nézte meg melyik követelményt / mellékletet / exportot. */
function erzekenyOlvasas(utvonal: string, query: unknown): boolean {
  switch (utvonal) {
    case '/api/elemek/:id':
    case '/api/elemek/:id/verziok/:v/mellekletek/:mid/tartalom':
    case '/api/kiadasok/:id/tartalom':
    case '/api/felhasznalok':
    case '/api/audit':
      return true;
    case '/api/elemek':
      // A teljes tartalmú (dosszié/export jellegű) lista érzékeny; az összegző lista nem.
      return (query as { nezet?: string } | undefined)?.nezet === 'teljes';
    default:
      return false;
  }
}

/** Eldönti, kell-e naplózni a kérést, és ha igen, milyen eseményként. */
export function auditEsemeny(
  metodus: string,
  utvonal: string | undefined,
  statusz: number,
  query: unknown,
  olvasasNaplo: boolean,
): AuditEsemeny | null {
  if (!utvonal) return null; // illeszkedés nélküli út (404-es szkenner-zaj)
  if (utvonal === '/health' || utvonal.startsWith('/dok')) return null;
  if (statusz === 429) return null; // túlterhelés: a request-log rögzíti, a DB-t nem áraszthatja el
  if (statusz === 401 || statusz === 403) return 'hozzaferes-megtagadva';
  if (MODOSITO.has(metodus)) return 'modositas';
  if (metodus === 'GET' && olvasasNaplo && erzekenyOlvasas(utvonal, query)) return 'olvasas';
  return null;
}

/**
 * Kérés-szintű audit-napló. Az `onResponse`-ban fut (a válasz után — a kliens nem
 * vár rá), és rögzíti: minden módosítást (a sikerteleneket is), minden elutasított
 * hozzáférést (401/403), valamint az érzékeny olvasásokat.
 *
 * Kettős cél: a MongoDB-gyűjtemény kereshető (admin-felület), a strukturált
 * log-sor (`audit: {...}`) pedig a gépen kívüli naplógyűjtőbe továbbítható.
 * DB-kiesés alatt csak a log-sor készül (nem torlódnak fel a pufferelt írások).
 */
export const auditPlugin = fp(async (app: FastifyInstance) => {
  const fuggoben = new Set<Promise<unknown>>();

  app.decorate('auditFlush', async () => {
    // Az onResponse a válasz UTÁN fut (a kliens — és egy teszt inject-je — már megkapta
    // a választ): néhány makrotaszkot átengedünk, hogy a befejezett kérések hookjai
    // beálljanak a sorba, és csak utána várjuk be az írásokat.
    for (let i = 0; i < 5; i++) await new Promise<void>((r) => setImmediate(r));
    await Promise.all([...fuggoben]);
  });
  app.addHook('onClose', async () => {
    await Promise.all([...fuggoben]);
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const utvonal = req.routeOptions?.url;
    const esemeny = auditEsemeny(req.method, utvonal, reply.statusCode, req.query, config.auditOlvasas);
    if (!esemeny || !utvonal) return;

    // Sima objektumba másolva: a paraméter nélküli útvonalakon a Fastify params-a
    // null-prototípusú, amit a Mongoose (isPOJO) nem tud menteni.
    const params = { ...((req.params ?? {}) as Record<string, string>) };
    const bejegyzes = {
      idopont: new Date(),
      esemeny,
      felhasznaloId: req.felhasznalo?.id ?? null,
      email: req.felhasznalo?.email?.toLowerCase() ?? null,
      nev: req.felhasznalo?.nev ?? null,
      ip: req.ip,
      metodus: req.method,
      utvonal,
      ut: req.url.split('?')[0]!, // a query SOHA (pl. az aláírt URL sig-je)
      parameterek: params,
      elemId: utvonal.startsWith('/api/elemek/:id') ? (params.id ?? null) : null,
      statusz: reply.statusCode,
      idotartamMs: Math.round(reply.elapsedTime),
    };

    req.log.info({ audit: bejegyzes }, 'audit');
    if (dbAllapot() !== 1) return;

    const iras: Promise<unknown> = AuditBejegyzes.create(bejegyzes)
      .catch((err: unknown) => req.log.error({ err }, 'Audit-napló írási hiba'))
      .finally(() => fuggoben.delete(iras));
    fuggoben.add(iras);
  });
});
