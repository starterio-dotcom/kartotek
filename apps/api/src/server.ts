import { buildApp } from './app.js';
import { csatlakozasDb } from './db/mongoose.js';
import { config } from './config.js';
import { OidcProvider } from './auth/oidc-provider.js';
import { jwksVerifikator } from './auth/oidc-verifier.js';
import type { AuthProvider } from './auth/provider.js';
import { utemezoIndit } from './utemezo/idozito.js';

/**
 * Éles indulási biztonsági ellenőrzések — fail-fast, mielőtt bármit kiszolgálnánk.
 * A production nem indulhat el a dev fejléc-hitelesítéssel (tetszőleges
 * megszemélyesítés), sem a melléklet-URL aláíró titok nélkül.
 */
function elesGuard(): void {
  if (!config.eles) return;
  if (config.authProvider !== 'oidc')
    throw new Error(
      'Éles indulás dev hitelesítéssel megtagadva: állíts be AUTH_PROVIDER=oidc-ot ' +
        '(a dev fejléc-provider tetszőleges felhasználó megszemélyesítését engedné).',
    );
  if (!config.mellekletTitok)
    throw new Error('Éles indulás megtagadva: MELLEKLET_URL_SECRET megadása kötelező.');
}

/** A konfigurált hitelesítési provider (dev fejléc vagy OIDC + JWKS). */
function authProvider(): AuthProvider | undefined {
  if (config.authProvider !== 'oidc') return undefined; // dev fejléc-provider az alap
  const { issuer, jwksUri, audience, emailClaim } = config.oidc;
  if (!issuer || !jwksUri)
    throw new Error('OIDC mód: OIDC_ISSUER és OIDC_JWKS_URI megadása kötelező.');
  return new OidcProvider({
    issuer,
    ...(audience ? { audience } : {}),
    emailClaim,
    verifikal: jwksVerifikator({ issuer, jwksUri, ...(audience ? { audience } : {}) }),
  });
}

async function fo(): Promise<void> {
  elesGuard();
  const provider = authProvider();
  const app = await buildApp(provider ? { authProvider: provider } : {});

  // Először figyeljünk (a /health azonnal válaszol), a DB-t a háttérben kötjük be.
  // A kapcsolat hiánya nem dönti le az API-t — a /health jelzi az állapotot.
  await app.listen({ port: config.port, host: '0.0.0.0' });

  // Újrapróbálkozás, amíg a DB elérhetővé nem válik — az API nem függhet attól,
  // hogy a mongod előbb indult-e el (együttes restart/boot). A sikeres első
  // csatlakozás után a driver már magától kezeli a kapcsolat-kieséseket.
  void (async () => {
    for (let kiserlet = 1; ; kiserlet++) {
      try {
        await csatlakozasDb();
        app.log.info('MongoDB kapcsolat él');
        // Az ütemezőt csak élő DB-kapcsolat után indítjuk (az elosztott zár DB-t igényel).
        utemezoIndit(app.log);
        return;
      } catch (e) {
        app.log.warn({ err: e, kiserlet }, 'MongoDB nem elérhető — újrapróbálkozás 5 mp múlva');
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}

fo().catch((e) => {
  console.error(e);
  process.exit(1);
});
