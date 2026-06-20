// Önfenntartó E2E-futtató (Docker nélkül): in-memory MongoDB replica set → seed →
// API + web dev-szerverek → `playwright test` → takarítás. Egy folyamat, így a
// sorrend és a leállítás determinisztikus (nem a Playwright webServer-re bízzuk).
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const isWin = process.platform === 'win32';
const children = [];

function inditSzerver(nev, args, extraEnv) {
  const p = spawn('pnpm', args, {
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: true,
  });
  children.push({ nev, p });
  return p;
}

async function varakozik(url, timeoutMs, nev) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* még nem él */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Időtúllépés a(z) ${nev} várásakor: ${url}`);
}

function killAll() {
  for (const { p } of children) {
    if (!p.pid) continue;
    if (isWin) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        p.kill('SIGKILL');
      } catch {
        /* már leállt */
      }
    }
  }
}

let repl;
try {
  console.log('E2E: in-memory MongoDB replica set indítása…');
  repl = await MongoMemoryReplSet.create({ replSet: { name: 'rs0', count: 1 } });
  const base = repl.getUri('kartotek');
  const uri = base + (base.includes('?') ? '&' : '?') + 'directConnection=true';

  console.log('E2E: seed betöltése…');
  const seed = spawnSync('pnpm', ['--filter', '@kartotek/api', 'seed'], {
    env: { ...process.env, MONGO_URI: uri },
    stdio: 'inherit',
    shell: true,
  });
  if (seed.status !== 0) throw new Error('A seed sikertelen.');

  console.log('E2E: API + web dev-szerverek indítása…');
  inditSzerver('api', ['--filter', '@kartotek/api', 'dev'], { MONGO_URI: uri });
  inditSzerver('web', ['--filter', '@kartotek/web', 'dev'], {});

  await varakozik('http://localhost:3001/health', 60_000, 'API');
  await varakozik('http://localhost:5173', 60_000, 'web');
  console.log('E2E: szerverek készen — playwright test indul.');

  // Csak a dev-módú füstteszt (az OIDC-spec külön harnesst igényel: run-oidc.mjs).
  const pw = spawnSync('pnpm', ['exec', 'playwright', 'test', 'e2e/smoke.spec.ts'], {
    stdio: 'inherit',
    shell: true,
  });
  process.exitCode = pw.status ?? 1;
} catch (e) {
  console.error('E2E hiba:', e);
  process.exitCode = 1;
} finally {
  killAll();
  if (repl) await repl.stop();
}
