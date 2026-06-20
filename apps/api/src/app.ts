import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { dbAllapot } from './db/mongoose.js';
import { config } from './config.js';
import { hibakezeloRegisztracio } from './hibak.js';
import { authPlugin } from './auth/plugin.js';
import { biztonsagPlugin } from './biztonsag/plugin.js';
import type { AuthProvider } from './auth/provider.js';
import { apiRoutes } from './modulok/routes.js';
import { LemezTarhely, type Tarhely } from './tarhely/tarhely.js';

declare module 'fastify' {
  interface FastifyInstance {
    tarhely: Tarhely;
  }
}

export interface AppOpciok {
  authProvider?: AuthProvider;
  tarhely?: Tarhely;
}

export async function buildApp(opts: AppOpciok = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  // A Zod-sémák egyszerre validálnak és adják az OpenAPI-leírást.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  hibakezeloRegisztracio(app);

  // CORS: éles módban allow-list (CORS_ORIGIN), dev-ben bármely origin.
  await app.register(cors, {
    origin: config.corsOrigin ?? (config.eles ? false : true),
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB
  await app.register(biztonsagPlugin, {
    rateLimitMax: config.rateLimitMax,
    rateLimitAblakMs: config.rateLimitAblakMs,
    eles: config.eles,
  });
  await app.register(authPlugin, { ...(opts.authProvider ? { provider: opts.authProvider } : {}) });

  app.decorate('tarhely', opts.tarhely ?? new LemezTarhely(config.tarhelyDir));

  await app.register(swagger, {
    openapi: {
      info: { title: 'Kartotékrendszer API', version: '0.1.0' },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/dok' });

  const HealthValasz = z.object({
    statusz: z.literal('ok'),
    idopont: z.string(),
    db: z.object({ readyState: z.number(), csatlakozva: z.boolean() }),
  });

  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        description: 'Életjel + DB-kapcsolat állapota',
        tags: ['rendszer'],
        response: { 200: HealthValasz },
      },
    },
    async () => {
      const readyState = dbAllapot();
      return {
        statusz: 'ok' as const,
        idopont: new Date().toISOString(),
        db: { readyState, csatlakozva: readyState === 1 },
      };
    },
  );

  await app.register(apiRoutes);

  return app;
}
