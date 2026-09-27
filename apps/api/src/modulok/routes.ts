import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ElemLetrehozasDto,
  VerzioSzerkesztesDto,
  JovahagyasDto,
  IndoklasDto,
  MegjegyzesLetrehozasDto,
  KapcsolatLetrehozasDto,
  TipusKodSchema,
  RetegKodSchema,
  StatuszSchema,
} from '@kartotek/shared';
import { hiba403 } from '../hibak.js';
import { ellenoriz } from '../auth/rbac.js';
import {
  elemLetrehozas,
  elemLista,
  elemReszlet,
  cimkekFrissites,
  OSSZEGZO_MAX,
  type ElemSzuro,
} from './elemek/szolgaltatas.js';
import * as verzio from './verziok/szolgaltatas.js';
import * as velemenyezes from './velemenyezes/szolgaltatas.js';
import * as kapcsolat from './kapcsolatok/szolgaltatas.js';
import * as szervezet from './szervezet/szolgaltatas.js';
import * as melleklet from './mellekletek/szolgaltatas.js';
import { ervenyesAlairas } from './mellekletek/url-alairas.js';
import { grafLekeres } from './graf/szolgaltatas.js';
import { torlesElokeszit, elemTorles } from './torles/szolgaltatas.js';
import { lefedettsegRiport, megfelelesRiport, hatasRiport } from './riportok/szolgaltatas.js';
import * as kiadas from './kiadasok/szolgaltatas.js';
import { utemezoFut } from '../utemezo/szolgaltatas.js';
import { auditLista } from '../audit/szolgaltatas.js';
import { exportAdat, type ExportAdat } from '../export/adat.js';
import { csvKeszit } from '../export/csv.js';
import { reqifKeszit } from '../export/reqif.js';
import { ertesitesLista, olvasottraAllit } from '../ertesites/szolgaltatas.js';
import { globalisAdminKell } from '../auth/plugin.js';

const IdParam = z.object({ id: z.string() });
const VerzioParam = z.object({ id: z.string(), v: z.coerce.number().int().positive() });
const MjParam = z.object({ id: z.string(), v: z.coerce.number().int().positive(), mjid: z.string() });
const MidParam = z.object({ id: z.string(), v: z.coerce.number().int().positive(), mid: z.string() });

const LISTA_SZURO = z.object({
  alkalmazasKod: z.string().optional(),
  tipusKod: TipusKodSchema.optional(),
  retegKod: RetegKodSchema.optional(),
  statusz: StatuszSchema.optional(),
  cimke: z.string().optional(),
  kereses: z.string().optional(),
  // Lapozás + projekció: az alap az összegző nézet; a teljes csak alkalmazásra szűrve.
  nezet: z.enum(['osszegzo', 'teljes']).default('osszegzo'),
  limit: z.coerce.number().int().min(1).max(OSSZEGZO_MAX).optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function apiRoutes(appBase: FastifyInstance): Promise<void> {
  const app = appBase.withTypeProvider<ZodTypeProvider>();

  const lathatoAlkalmazasok = (felh: {
    globalisAdmin: boolean;
    tagsagok: { alkalmazasKod: string }[];
  }): string[] | 'mind' =>
    felh.globalisAdmin ? 'mind' : [...new Set(felh.tagsagok.map((t) => t.alkalmazasKod))];

  /* ---------- Auth ---------- */
  app.get('/api/auth/en', { schema: { tags: ['auth'] } }, async (req) => {
    return app.bejelentkezesKell(req);
  });

  /* ---------- Szervezet ---------- */
  app.get('/api/szolgaltatasok', { schema: { tags: ['szervezet'] } }, async (req) => {
    return szervezet.szolgaltatasLista(app.bejelentkezesKell(req));
  });

  app.post(
    '/api/szolgaltatasok',
    {
      schema: {
        tags: ['szervezet'],
        body: z.object({
          kod: z.string().min(1),
          nev: z.string().min(1),
          leiras: z.string().optional(),
          gazdaId: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      reply.code(201);
      return szervezet.szolgaltatasLetrehozas(req.body, felh);
    },
  );

  app.get('/api/alkalmazasok', { schema: { tags: ['szervezet'] } }, async (req) => {
    return szervezet.alkalmazasLista(app.bejelentkezesKell(req));
  });

  app.get('/api/felhasznalok', { schema: { tags: ['szervezet'] } }, async (req) => {
    return szervezet.felhasznaloLista(app.bejelentkezesKell(req));
  });

  app.patch(
    '/api/felhasznalok/:id',
    {
      schema: {
        tags: ['szervezet'],
        params: z.object({ id: z.string() }),
        body: z.object({
          tagsagok: z
            .array(
              z.object({
                alkalmazasKod: z.string().min(1),
                szerepkor: z.enum(['Olvasó', 'Szerző', 'Jóváhagyó', 'Admin']),
              }),
            )
            .optional(),
          globalisAdmin: z.boolean().optional(),
        }),
      },
    },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return szervezet.felhasznaloFrissites(req.params.id, req.body, felh);
    },
  );

  app.post(
    '/api/alkalmazasok',
    {
      schema: {
        tags: ['szervezet'],
        body: z.object({
          kod: z.string().min(1),
          nev: z.string().min(1),
          leiras: z.string().optional(),
          szolgaltatasKod: z.string().min(1),
        }),
      },
    },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      reply.code(201);
      return szervezet.alkalmazasLetrehozas(req.body, felh);
    },
  );

  app.patch(
    '/api/alkalmazasok/:kod',
    {
      schema: {
        tags: ['szervezet'],
        params: z.object({ kod: z.string() }),
        body: z.object({ nev: z.string().min(1).optional(), leiras: z.string().optional() }),
      },
    },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return szervezet.alkalmazasFrissites(req.params.kod, req.body, felh);
    },
  );

  app.patch(
    '/api/szolgaltatasok/:kod',
    {
      schema: {
        tags: ['szervezet'],
        params: z.object({ kod: z.string() }),
        body: z.object({ nev: z.string().min(1).optional(), leiras: z.string().optional() }),
      },
    },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return szervezet.szolgaltatasFrissites(req.params.kod, req.body, felh);
    },
  );

  /* ---------- Elemek ---------- */
  app.get(
    '/api/elemek',
    { schema: { tags: ['elemek'], querystring: LISTA_SZURO } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      const szuro: ElemSzuro = { ...req.query, lathatoAlkalmazasok: lathatoAlkalmazasok(felh) };
      const { elemek, osszes } = await elemLista(szuro);
      // A törzs tömb marad (kompatibilis); az összes találat a fejlécben (lapozáshoz).
      reply.header('X-Osszes', String(osszes));
      return elemek;
    },
  );

  app.post(
    '/api/elemek',
    { schema: { tags: ['elemek'], body: ElemLetrehozasDto } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      // RBAC: elem.létrehozás az adott alkalmazáson.
      ellenoriz('elem.létrehozás', felh, { alkalmazasKod: req.body.alkalmazasKod });
      reply.code(201);
      return elemLetrehozas(req.body, felh);
    },
  );

  app.get(
    '/api/elemek/:id',
    { schema: { tags: ['elemek'], params: IdParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      const elem = await elemReszlet(req.params.id);
      const lathato = lathatoAlkalmazasok(felh);
      if (lathato !== 'mind' && !lathato.includes(elem.alkalmazasKod as string))
        throw hiba403('Nincs olvasási jogosultság ehhez az alkalmazáshoz.');
      return elem;
    },
  );

  app.get(
    '/api/elemek/:id/kapcsolatok',
    { schema: { tags: ['kapcsolatok'], params: IdParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      // Az elemnek magának is olvashatónak kell lennie (mint a részletnél); a nem
      // olvasható végű kapcsolatok hivatkozás-csonkként jönnek vissza.
      return kapcsolat.kapcsolatokElemre(req.params.id, lathatoAlkalmazasok(felh));
    },
  );

  app.patch(
    '/api/elemek/:id/verziok/:v',
    { schema: { tags: ['verziók'], params: VerzioParam, body: VerzioSzerkesztesDto } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return verzio.verzioSzerkesztes(req.params.id, req.params.v, req.body, felh);
    },
  );

  app.patch(
    '/api/elemek/:id/cimkek',
    { schema: { tags: ['elemek'], params: IdParam, body: z.object({ cimkek: z.array(z.string()) }) } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return cimkekFrissites(req.params.id, req.body.cimkek, felh);
    },
  );

  // Fizikai törlés preflight: törölhető-e az elem, és ha nem, miért.
  app.get(
    '/api/elemek/:id/torolheto',
    { schema: { tags: ['elemek'], params: IdParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return torlesElokeszit(req.params.id, felh);
    },
  );

  // Fizikai törlés (csak sosem hivatkozott Vázlatnál; egyébként 409 indoklással).
  app.delete(
    '/api/elemek/:id',
    { schema: { tags: ['elemek'], params: IdParam } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      await elemTorles(req.params.id, felh);
      reply.code(204);
      return null;
    },
  );

  // Hatáselemzés: mit érint az elem változása (lebontja / függ tőle, mindkét irány).
  app.get(
    '/api/elemek/:id/hatas',
    { schema: { tags: ['riportok'], params: IdParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return hatasRiport(req.params.id, lathatoAlkalmazasok(felh));
    },
  );

  /* ---------- Verzió-életciklus ---------- */
  const leptetes = (
    utvonal: string,
    fn: (id: string, v: number, felh: ReturnType<typeof app.bejelentkezesKell>) => Promise<unknown>,
  ) =>
    app.post(
      `/api/elemek/:id/verziok/:v/${utvonal}`,
      { schema: { tags: ['verziók'], params: VerzioParam } },
      async (req) => {
        const felh = app.bejelentkezesKell(req);
        return fn(req.params.id, req.params.v, felh);
      },
    );

  // Beküldés → az alkalmazás Jóváhagyói értesítést kapnak (spec: Értesítések).
  leptetes('bekuldes', async (id, v, felh) => {
    const elem = await verzio.bekuldes(id, v, felh);
    app.ertesito.esemeny({ esemeny: 'bekuldes', elem, verzioSzam: v, felh });
    return elem;
  });
  leptetes('visszavonas', (id, v, felh) => verzio.visszavonas(id, v, felh));
  leptetes('ujverzio', (id, v, felh) => verzio.ujVerzio(id, v, felh));
  leptetes('archivalas', (id, v, felh) => verzio.archivalas(id, v, felh));

  app.post(
    '/api/elemek/:id/verziok/:v/jovahagyas',
    { schema: { tags: ['verziók'], params: VerzioParam, body: JovahagyasDto } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      const elem = await verzio.jovahagyas(req.params.id, req.params.v, req.body, felh);
      const k = req.body.hatalyKezdet.toISOString().slice(0, 10);
      const vg = req.body.hatalyVeg ? req.body.hatalyVeg.toISOString().slice(0, 10) : 'visszavonásig';
      app.ertesito.esemeny({
        esemeny: 'jovahagyas',
        elem,
        verzioSzam: req.params.v,
        felh,
        reszlet: `hatály: ${k} – ${vg}`,
      });
      return elem;
    },
  );

  app.post(
    '/api/elemek/:id/verziok/:v/visszadobas',
    { schema: { tags: ['verziók'], params: VerzioParam, body: IndoklasDto } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      const elem = await verzio.visszadobas(req.params.id, req.params.v, req.body.indoklas, felh);
      app.ertesito.esemeny({
        esemeny: 'visszadobas',
        elem,
        verzioSzam: req.params.v,
        felh,
        reszlet: req.body.indoklas,
      });
      return elem;
    },
  );

  app.post(
    '/api/elemek/:id/verziok/:v/elvetes',
    { schema: { tags: ['verziók'], params: VerzioParam, body: z.object({ indoklas: z.string().optional() }) } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return verzio.elvetes(req.params.id, req.params.v, felh, req.body.indoklas);
    },
  );

  app.post(
    '/api/elemek/:id/verziok/:v/kivezetes',
    { schema: { tags: ['verziók'], params: VerzioParam, body: z.object({ hatalyVeg: z.coerce.date() }) } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return verzio.kivezetes(req.params.id, req.params.v, req.body.hatalyVeg, felh);
    },
  );

  app.post(
    '/api/elemek/:id/verziok/:v/kiadas',
    {
      schema: {
        tags: ['kiadások'],
        params: VerzioParam,
        body: z.object({ kiadasId: z.string(), hozzarendel: z.boolean().default(true) }),
      },
    },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return kiadas.verzioKiadasBeallit(
        req.params.id,
        req.params.v,
        req.body.kiadasId,
        req.body.hozzarendel,
        felh,
      );
    },
  );

  /* ---------- Véleményezés ---------- */
  app.post(
    '/api/elemek/:id/verziok/:v/megjegyzesek',
    { schema: { tags: ['véleményezés'], params: VerzioParam, body: MegjegyzesLetrehozasDto } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      reply.code(201);
      const elem = await velemenyezes.megjegyzesLetrehozas(req.params.id, req.params.v, req.body, felh);
      // Új megjegyzés → a másik fél (Szerző ↔ Jóváhagyó); válasznál a szülő szerzője is.
      app.ertesito.esemeny({
        esemeny: 'megjegyzes',
        elem,
        verzioSzam: req.params.v,
        felh,
        reszlet: req.body.szoveg,
        ...(req.body.valaszMjid ? { valaszMjid: req.body.valaszMjid } : {}),
      });
      return elem;
    },
  );

  /* ---------- Felületi értesítések (csak a saját) ---------- */
  app.get(
    '/api/ertesitesek',
    {
      schema: {
        tags: ['értesítések'],
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
      },
    },
    async (req) => ertesitesLista(app.bejelentkezesKell(req).id, req.query.limit),
  );

  app.post(
    '/api/ertesitesek/olvasva',
    {
      schema: {
        tags: ['értesítések'],
        body: z.object({ idk: z.array(z.string()).optional() }).optional(),
      },
    },
    async (req) => olvasottraAllit(app.bejelentkezesKell(req).id, req.body?.idk),
  );

  app.post(
    '/api/elemek/:id/verziok/:v/megjegyzesek/:mjid/megoldas',
    { schema: { tags: ['véleményezés'], params: MjParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return velemenyezes.megjegyzesMegoldas(req.params.id, req.params.v, req.params.mjid, felh);
    },
  );

  /* ---------- Mellékletek ---------- */
  app.post(
    '/api/elemek/:id/verziok/:v/mellekletek',
    { schema: { tags: ['mellékletek'], params: VerzioParam, consumes: ['multipart/form-data'] } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      const fajl = await req.file();
      if (!fajl) throw hiba403('Hiányzik a feltöltött fájl.');
      const buffer = await fajl.toBuffer();
      const mezoErtek = (n: string): string | undefined => {
        const f = fajl.fields[n];
        return f && !Array.isArray(f) && 'value' in f ? String((f as { value: unknown }).value) : undefined;
      };
      reply.code(201);
      return melleklet.mellekletFeltoltes(
        app.tarhely,
        req.params.id,
        req.params.v,
        {
          buffer,
          fajlNev: fajl.filename,
          mime: fajl.mimetype,
          ...(mezoErtek('alt') ? { alt: mezoErtek('alt')! } : {}),
          ...(mezoErtek('figmaLink') ? { figmaLink: mezoErtek('figmaLink')! } : {}),
        },
        felh,
      );
    },
  );

  app.post(
    '/api/elemek/:id/verziok/:v/mellekletek/figma',
    {
      schema: {
        tags: ['mellékletek'],
        params: VerzioParam,
        body: z.object({ alt: z.string().min(1), figmaLink: z.string().url() }),
      },
    },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      reply.code(201);
      return melleklet.figmaLinkFelvetel(req.params.id, req.params.v, req.body, felh);
    },
  );

  app.get(
    '/api/elemek/:id/verziok/:v/mellekletek/:mid/tartalom',
    // Nem publikus: aláírt URL (a natív <img>/<video> ezzel tölt), VAGY hitelesített
    // munkamenet + hatókör (a fejléces blob-fetch útnak). Egyik sem → 401/403.
    {
      schema: {
        tags: ['mellékletek'],
        params: MidParam,
        querystring: z.object({ exp: z.coerce.number().optional(), sig: z.string().optional() }),
      },
    },
    async (req, reply) => {
      const { id, v, mid } = req.params;
      const alairtOk = ervenyesAlairas(id, v, mid, req.query.exp, req.query.sig);
      if (!alairtOk) {
        const felh = req.felhasznalo;
        if (!felh) return reply.code(401).send({ hiba: 'Bejelentkezés szükséges' });
        const kod = await melleklet.elemAlkalmazasKod(id);
        if (kod && !felh.globalisAdmin && !felh.tagsagok.some((t) => t.alkalmazasKod === kod))
          return reply.code(403).send({ hiba: 'Nincs jogosultság az elem mellékletéhez.' });
      }
      const t = await melleklet.mellekletTartalom(app.tarhely, id, v, mid);
      if (!t) return reply.code(404).send({ hiba: 'A melléklet tartalma nem elérhető.' });
      return reply.header('content-type', t.mime).send(t.buffer);
    },
  );

  app.delete(
    '/api/elemek/:id/verziok/:v/mellekletek/:mid',
    { schema: { tags: ['mellékletek'], params: MidParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return melleklet.mellekletTorles(app.tarhely, req.params.id, req.params.v, req.params.mid, felh);
    },
  );

  /* ---------- Kapcsolatok ---------- */
  app.post(
    '/api/kapcsolatok',
    { schema: { tags: ['kapcsolatok'], body: KapcsolatLetrehozasDto } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      reply.code(201);
      return kapcsolat.kapcsolatLetrehozas(req.body, felh);
    },
  );

  app.delete(
    '/api/kapcsolatok/:id',
    { schema: { tags: ['kapcsolatok'], params: IdParam } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      await kapcsolat.kapcsolatTorles(req.params.id, felh);
      reply.code(204);
      return null;
    },
  );

  /* ---------- Gráf ---------- */
  app.get(
    '/api/graf',
    {
      schema: {
        tags: ['gráf'],
        querystring: z.object({ alkalmazasKod: z.string().optional() }),
      },
    },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return grafLekeres(lathatoAlkalmazasok(felh), req.query.alkalmazasKod);
    },
  );

  /* ---------- Riportok ---------- */
  const RiportSzuro = z.object({ alkalmazasKod: z.string().optional() });

  app.get(
    '/api/riportok/lefedettseg',
    { schema: { tags: ['riportok'], querystring: RiportSzuro } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return lefedettsegRiport(lathatoAlkalmazasok(felh), req.query.alkalmazasKod);
    },
  );

  app.get(
    '/api/riportok/megfeleles',
    { schema: { tags: ['riportok'], querystring: RiportSzuro } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return megfelelesRiport(lathatoAlkalmazasok(felh), req.query.alkalmazasKod);
    },
  );

  /* ---------- Kiadások (release) ---------- */
  app.get('/api/kiadasok', { schema: { tags: ['kiadások'] } }, async (req) => {
    app.bejelentkezesKell(req);
    return kiadas.kiadasLista();
  });

  app.post(
    '/api/kiadasok',
    {
      schema: {
        tags: ['kiadások'],
        body: z.object({ verzio: z.string().min(1), datum: z.coerce.date() }),
      },
    },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      reply.code(201);
      return kiadas.kiadasLetrehozas(req.body, felh);
    },
  );

  app.get(
    '/api/kiadasok/:id/tartalom',
    { schema: { tags: ['kiadások'], params: IdParam } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return kiadas.kiadasTartalom(req.params.id, lathatoAlkalmazasok(felh));
    },
  );

  /* ---------- Ütemező ---------- */
  app.post(
    '/api/utemezo/futtat',
    { schema: { tags: ['ütemező'], body: z.object({ ma: z.coerce.date().optional() }).optional() } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      // Az ütemezőt csak globális Admin indíthatja kézzel (RENDSZER nevében naplóz).
      if (!felh.globalisAdmin) throw hiba403('Az ütemezőt csak globális Admin indíthatja.');
      return utemezoFut(req.body?.ma);
    },
  );

  /* ---------- Export (CSV, ReqIF) — olvasási hatókörrel, auditálva ---------- */
  const ExportSzuro = z.object({
    alkalmazasKod: z.string().min(1),
    mod: z.enum(['hatalyos', 'legujabb']).default('legujabb'),
  });
  const fajlnev = (adat: ExportAdat, kiterjesztes: string) =>
    `kartotek-${adat.alkalmazas.kod.replace(/[^A-Za-z0-9_-]/g, '_')}-${adat.mod}-${adat.generalva
      .toISOString()
      .slice(0, 10)}.${kiterjesztes}`;

  app.get(
    '/api/export/csv',
    { schema: { tags: ['export'], querystring: ExportSzuro } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      const adat = await exportAdat(req.query.alkalmazasKod, req.query.mod, lathatoAlkalmazasok(felh));
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${fajlnev(adat, 'csv')}"`);
      return csvKeszit(adat);
    },
  );

  app.get(
    '/api/export/reqif',
    { schema: { tags: ['export'], querystring: ExportSzuro } },
    async (req, reply) => {
      const felh = app.bejelentkezesKell(req);
      const adat = await exportAdat(req.query.alkalmazasKod, req.query.mod, lathatoAlkalmazasok(felh));
      reply
        .header('Content-Type', 'application/xml; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${fajlnev(adat, 'reqif')}"`);
      return reqifKeszit(adat);
    },
  );

  /* ---------- Audit-napló (csak olvasás, csak globális Admin) ---------- */
  app.get(
    '/api/audit',
    {
      schema: {
        tags: ['audit'],
        querystring: z.object({
          felhasznalo: z.string().optional(),
          elemId: z.string().optional(),
          esemeny: z.enum(['modositas', 'hozzaferes-megtagadva', 'olvasas']).optional(),
          metodus: z.string().optional(),
          statusz: z.coerce.number().int().optional(),
          tol: z.coerce.date().optional(),
          ig: z.coerce.date().optional(),
          limit: z.coerce.number().int().min(1).max(500).default(100),
          offset: z.coerce.number().int().min(0).default(0),
        }),
      },
    },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      globalisAdminKell(felh);
      return auditLista(req.query);
    },
  );
}
