import 'dotenv/config';

const eles = (process.env.NODE_ENV ?? 'development') === 'production';

/**
 * A Fastify `trustProxy` értéke a TRUST_PROXY-ból. Élesben alapból csak a helyi
 * reverse proxyban bízunk ('loopback') — egy általános `true` a közvetlenül elérhető
 * API-porton hamisított X-Forwarded-For-ral kijátszhatóvá tenné az IP-alapú korlátot.
 */
function trustProxyErtek(ertek: string | undefined): boolean | string | number {
  if (ertek === undefined || ertek === '') return eles ? 'loopback' : false;
  if (ertek === 'true') return true;
  if (ertek === 'false') return false;
  if (/^\d+$/.test(ertek)) return Number(ertek); // megbízható proxy-ugrások száma
  return ertek; // IP/CIDR-lista vagy nevesített tartomány (pl. 'loopback')
}

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
  /** A figyelt interfész. Élesben reverse proxy mögött: 127.0.0.1 (a port ne legyen kívülről elérhető). */
  host: process.env.API_HOST ?? '0.0.0.0',
  /** Fastify trustProxy (lásd trustProxyErtek). */
  trustProxy: trustProxyErtek(process.env.TRUST_PROXY),
  mongoUri:
    process.env.MONGO_URI ??
    'mongodb://localhost:27017/kartotek?replicaSet=rs0&directConnection=true',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  eles,
  tarhelyDir: process.env.TARHELY_DIR ?? './.tarhely',
  /** Engedélyezett CORS-originek (vesszővel). Hiányában dev: bármely; éles: tiltó. */
  corsOrigin: lista(process.env.CORS_ORIGIN),
  /** Rate-limit, IP-szint (hitelesítés ELŐTT, a DB védelmére): max kérés/ablak egy IP-ről (0 = ki).
   *  Bőkezű, mert egy hivatal sok felhasználója egyetlen NAT-olt IP mögött ülhet. */
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 1200),
  /** Rate-limit, felhasználó-szint (hitelesítés UTÁN, méltányosság): max kérés/ablak felhasználónként. */
  rateLimitFelhasznaloMax: Number(process.env.RATE_LIMIT_FELHASZNALO_MAX ?? 300),
  rateLimitAblakMs: Number(process.env.RATE_LIMIT_ABLAK_MS ?? 60_000),
  /** Hitelesítési mód: 'dev' (fejléc) vagy 'oidc'. */
  authProvider: (process.env.AUTH_PROVIDER ?? 'dev') as 'dev' | 'oidc',
  /** OIDC-belépőnek, ha még nincs DB-felhasználója, hozzunk-e létre jogosultság nélkülit. */
  autoProvision: (process.env.OIDC_AUTO_PROVISION ?? 'false') === 'true',
  /** A melléklet-tartalom aláírt URL-jeit hitelesítő titok. Éles: kötelező (indulási guard);
   *  dev/teszt: rögzített fallback (a natív média így is tölt). */
  mellekletTitok: process.env.MELLEKLET_URL_SECRET ?? (eles ? undefined : 'dev-melleklet-titok'),
  /** Az aláírt melléklet-URL érvényességi ideje ms-ben (alap 24 óra). */
  mellekletUrlTtlMs: Number(process.env.MELLEKLET_URL_TTL_MS ?? 24 * 60 * 60 * 1000),
  /** Audit-napló: az érzékeny olvasások (elem-részlet, melléklet, teljes lista) is naplózódjanak. */
  auditOlvasas: (process.env.AUDIT_OLVASAS ?? 'true') === 'true',
  /** Audit-napló megőrzési ideje napokban; 0 = korlátlan (állami megőrzési kötelezettség). */
  auditMegorzesNap: Number(process.env.AUDIT_MEGORZES_NAP ?? 0),
  /** A szerveroldali ütemező automatizmusa (dátumvezérelt átmenetek). */
  utemezoAktiv: (process.env.UTEMEZO_AKTIV ?? 'true') === 'true',
  /** Az ütemező ellenőrzési gyakorisága ms-ben (alap óránként). */
  utemezoIntervalMs: Number(process.env.UTEMEZO_INTERVAL_MS ?? 60 * 60 * 1000),
  oidc: {
    issuer: process.env.OIDC_ISSUER,
    audience: process.env.OIDC_AUDIENCE,
    jwksUri: process.env.OIDC_JWKS_URI,
    emailClaim: process.env.OIDC_EMAIL_CLAIM ?? 'email',
  },
} as const;
