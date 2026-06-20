// OIDC böngésző-flow futtató (Fázis 8): a FUTÓ helyi Keycloak (8088) + seedelt
// Docker-mongo ellen felhúzza az API-t és a webet OIDC-módban, majd lefuttatja az
// e2e/oidc.spec.ts-t. A 3001/5173 portnak SZABADNAK kell lennie (állítsd le a dev-appot).
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const children = [];

const ISSUER = 'http://localhost:8088/realms/kartotek';
const JWKS = `${ISSUER}/protocol/openid-connect/certs`;
const MONGO = 'mongodb://localhost:27017/kartotek?replicaSet=rs0&directConnection=true';

function start(args, env) {
  const p = spawn('pnpm', args, { env: { ...process.env, ...env }, stdio: 'inherit', shell: true });
  children.push(p);
  return p;
}

async function varakozik(url, timeoutMs, nev) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* még nem él */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Időtúllépés: ${nev} (${url})`);
}

function killAll() {
  for (const p of children) {
    if (!p.pid) continue;
    if (isWin) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else
      try {
        p.kill('SIGKILL');
      } catch {
        /* már leállt */
      }
  }
}

try {
  console.log('OIDC-e2e: Keycloak ellenőrzése…');
  await varakozik(`${ISSUER}/.well-known/openid-configuration`, 15_000, 'Keycloak');

  console.log('OIDC-e2e: API (OIDC) + web (OIDC) indítása…');
  start(['--filter', '@kartotek/api', 'dev'], {
    AUTH_PROVIDER: 'oidc',
    OIDC_ISSUER: ISSUER,
    OIDC_JWKS_URI: JWKS,
    MONGO_URI: MONGO,
    API_PORT: '3001',
    NODE_ENV: 'development',
  });
  start(['--filter', '@kartotek/web', 'dev'], {
    VITE_AUTH_MODE: 'oidc',
    VITE_OIDC_AUTHORITY: ISSUER,
    VITE_OIDC_CLIENT_ID: 'kartotek-web',
  });

  await varakozik('http://localhost:3001/health', 60_000, 'API');
  await varakozik('http://localhost:5173', 60_000, 'web');
  console.log('OIDC-e2e: szerverek készen — playwright.');

  const pw = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/oidc.spec.ts'], {
    stdio: 'inherit',
    shell: true,
  });
  process.exitCode = pw.status ?? 1;
} catch (e) {
  console.error('OIDC-e2e hiba:', e);
  process.exitCode = 1;
} finally {
  killAll();
}
