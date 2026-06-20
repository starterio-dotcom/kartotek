import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Szerepkor } from '@kartotek/shared';
import { Felhasznalo } from '../db/modellek.js';
import { hiba403 } from '../hibak.js';
import { config } from '../config.js';
import { DevFejlecProvider, type AuthProvider, type Identitas } from './provider.js';

/** A kérés aktuális felhasználója (a `shared` FelhasznaloCtx + megjelenítési mezők). */
export interface AktualisFelhasznalo {
  id: string;
  nev: string;
  email: string;
  globalisAdmin: boolean;
  tagsagok: { alkalmazasKod: string; szerepkor: Szerepkor }[];
}

declare module 'fastify' {
  interface FastifyRequest {
    felhasznalo?: AktualisFelhasznalo;
  }
  interface FastifyInstance {
    auth: AuthProvider;
    /** Garantálja, hogy van bejelentkezett felhasználó (különben 401/403). */
    bejelentkezesKell: (req: FastifyRequest) => AktualisFelhasznalo;
  }
}

export interface AuthOpciok {
  provider?: AuthProvider;
}

export const authPlugin = fp<AuthOpciok>(async (app: FastifyInstance, opts) => {
  const provider = opts.provider ?? new DevFejlecProvider();
  app.decorate('auth', provider);

  app.decorate('bejelentkezesKell', (req: FastifyRequest): AktualisFelhasznalo => {
    if (!req.felhasznalo) throw new AppHiba401();
    return req.felhasznalo;
  });

  // Minden kérésnél feloldjuk az identitást → DB-felhasználó → req.felhasznalo.
  app.addHook('onRequest', async (req) => {
    const id = await provider.azonosit(req);
    if (!id) return;
    let doc = id.email
      ? await Felhasznalo.findOne({ email: id.email }).lean()
      : await Felhasznalo.findById(id.id).lean();
    // OIDC auto-provisioning: hitelesített, de még ismeretlen e-mail → jogosultság
    // nélküli felhasználó (be tud lépni, de Adminnak kell szerepkört adnia).
    if (!doc && id.email && config.autoProvision) {
      doc = await ujProvisionoltFelhasznalo(id);
    }
    if (!doc) return;
    req.felhasznalo = {
      id: String(doc._id),
      nev: doc.nev,
      email: doc.email,
      globalisAdmin: doc.globalisAdmin ?? false,
      tagsagok: (doc.tagsagok ?? []).map((t) => ({
        alkalmazasKod: t.alkalmazasKod,
        szerepkor: t.szerepkor as Szerepkor,
      })),
    };
  });
});

/** Jogosultság nélküli felhasználó létrehozása OIDC-belépőnek (idempotens upsert). */
async function ujProvisionoltFelhasznalo(id: Identitas) {
  const nev = id.nev ?? id.email!.split('@')[0]!;
  await Felhasznalo.updateOne(
    { email: id.email },
    { $setOnInsert: { nev, email: id.email, tagsagok: [], globalisAdmin: false } },
    { upsert: true },
  );
  return Felhasznalo.findOne({ email: id.email }).lean();
}

class AppHiba401 extends Error {
  statusCode = 401;
  constructor() {
    super('Bejelentkezés szükséges');
    this.name = 'AppHiba';
  }
}

/** Segédfüggvény route-okon kívül: globális Admin kényszerítése. */
export function globalisAdminKell(felh: AktualisFelhasznalo): void {
  if (!felh.globalisAdmin) throw hiba403('Csak globális Admin végezheti');
}
