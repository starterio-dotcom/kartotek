import 'dotenv/config';

const eles = (process.env.NODE_ENV ?? 'development') === 'production';

/** Vesszővel tagolt lista környezeti változóból (üres → undefined). */
function lista(ertek: string | undefined): string[] | undefined {
  if (!ertek) return undefined;
  const elemek = ertek
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return elemek.length ? elemek : undefined;
}

export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  mongoUri:
    process.env.MONGO_URI ??
    'mongodb://localhost:27017/kartotek?replicaSet=rs0&directConnection=true',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  eles,
  tarhelyDir: process.env.TARHELY_DIR ?? './.tarhely',
  /** Engedélyezett CORS-originek (vesszővel). Hiányában dev: bármely; éles: tiltó. */
  corsOrigin: lista(process.env.CORS_ORIGIN),
  /** Rate-limit: max kérés/ablak egy IP-ről (0 = ki). */
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
  rateLimitAblakMs: Number(process.env.RATE_LIMIT_ABLAK_MS ?? 60_000),
  /** Hitelesítési mód: 'dev' (fejléc) vagy 'oidc'. */
  authProvider: (process.env.AUTH_PROVIDER ?? 'dev') as 'dev' | 'oidc',
  /** OIDC-belépőnek, ha még nincs DB-felhasználója, hozzunk-e létre jogosultság nélkülit. */
  autoProvision: (process.env.OIDC_AUTO_PROVISION ?? 'false') === 'true',
  oidc: {
    issuer: process.env.OIDC_ISSUER,
    audience: process.env.OIDC_AUDIENCE,
    jwksUri: process.env.OIDC_JWKS_URI,
    emailClaim: process.env.OIDC_EMAIL_CLAIM ?? 'email',
  },
} as const;
