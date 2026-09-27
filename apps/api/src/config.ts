import 'dotenv/config';
import { readFileSync } from 'node:fs';

const eles = (process.env.NODE_ENV ?? 'development') === 'production';

/**
 * A futó kiadás azonosítója (a /health adja vissza): a telepítő szkript a kiadás
 * gyökerébe (a szolgáltatás munkakönyvtárába) írja `KIADAS` néven — így deploy és
 * visszaállítás után ellenőrizhető, melyik változat fut.
 */
function kiadasAzonosito(): string {
  if (process.env.KIADAS) return process.env.KIADAS;
  try {
    return readFileSync('KIADAS', 'utf8').trim() || 'ismeretlen';
  } catch {
    return 'fejlesztői';
  }
}

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
  kiadas: kiadasAzonosito(),
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
  /** Az interaktív API-dokumentáció (/dok) élesben alapból KI: a teljes API-felület
   *  sémástul ne legyen hitelesítés nélkül olvasható. Dev-ben mindig elérhető. */
  dokElerheto: !eles || (process.env.DOK_ELESBEN ?? 'false') === 'true',
  /** Audit-napló: az érzékeny olvasások (elem-részlet, melléklet, teljes lista) is naplózódjanak. */
  auditOlvasas: (process.env.AUDIT_OLVASAS ?? 'true') === 'true',
  /** Audit-napló megőrzési ideje napokban; 0 = korlátlan (állami megőrzési kötelezettség). */
  auditMegorzesNap: Number(process.env.AUDIT_MEGORZES_NAP ?? 0),
  /** Az alkalmazás nyilvános címe (az értesítésekben lévő hivatkozásokhoz). */
  alkalmazasUrl: (process.env.ALKALMAZAS_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  /** Értesítések e-mail csatornája: 'ki' | 'naplo' (alap: csak naplóz) | 'smtp' (valódi küldés).
   *  A felületi értesítés ettől függetlenül mindig működik (a spec szerint az az alapcsatorna). */
  ertesitesEmail: (process.env.ERTESITES_EMAIL ?? 'naplo') as 'ki' | 'naplo' | 'smtp',
  ertesitesFelado: process.env.ERTESITES_FELADO ?? 'Kartotékrendszer <noreply@localhost>',
  /** Biztonsági szelep: ha meg van adva, CSAK ezekre a domainekre megy e-mail (pl. a demo
   *  felhasználók címei ne jussanak el idegen, valós domainre). */
  ertesitesEmailDomainek: lista(process.env.ERTESITES_EMAIL_DOMAINEK)?.map((d) => d.toLowerCase()),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  /** A felületi értesítések megőrzése napokban (TTL index). */
  ertesitesMegorzesNap: Number(process.env.ERTESITES_MEGORZES_NAP ?? 365),
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
