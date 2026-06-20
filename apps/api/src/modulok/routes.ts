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
  type ElemSzuro,
} from './elemek/szolgaltatas.js';
import * as verzio from './verziok/szolgaltatas.js';
import * as velemenyezes from './velemenyezes/szolgaltatas.js';
import * as kapcsolat from './kapcsolatok/szolgaltatas.js';
import * as szervezet from './szervezet/szolgaltatas.js';
import * as melleklet from './mellekletek/szolgaltatas.js';
import { grafLekeres } from './graf/szolgaltatas.js';
import { torlesElokeszit, elemTorles } from './torles/szolgaltatas.js';
import { lefedettsegRiport, megfelelesRiport, hatasRiport } from './riportok/szolgaltatas.js';
import * as kiadas from './kiadasok/szolgaltatas.js';
import { utemezoFut } from '../utemezo/szolgaltatas.js';

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
    app.bejelentkezesKell(req);
    return szervezet.szolgaltatasLista();
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
    app.bejelentkezesKell(req);
    return szervezet.alkalmazasLista();
  });

  app.get('/api/felhasznalok', { schema: { tags: ['szervezet'] } }, async (req) => {
    app.bejelentkezesKell(req);
    return szervezet.felhasznaloLista();
  });

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
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      const szuro: ElemSzuro = { ...req.query, lathatoAlkalmazasok: lathatoAlkalmazasok(felh) };
      return elemLista(szuro);
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
      app.bejelentkezesKell(req);
      return kapcsolat.kapcsolatokElemre(req.params.id);
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

  leptetes('bekuldes', (id, v, felh) => verzio.bekuldes(id, v, felh));
  leptetes('visszavonas', (id, v, felh) => verzio.visszavonas(id, v, felh));
  leptetes('ujverzio', (id, v, felh) => verzio.ujVerzio(id, v, felh));
  leptetes('archivalas', (id, v, felh) => verzio.archivalas(id, v, felh));

  app.post(
    '/api/elemek/:id/verziok/:v/jovahagyas',
    { schema: { tags: ['verziók'], params: VerzioParam, body: JovahagyasDto } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return verzio.jovahagyas(req.params.id, req.params.v, req.body, felh);
    },
  );

  app.post(
    '/api/elemek/:id/verziok/:v/visszadobas',
    { schema: { tags: ['verziók'], params: VerzioParam, body: IndoklasDto } },
    async (req) => {
      const felh = app.bejelentkezesKell(req);
      return verzio.visszadobas(req.params.id, req.params.v, req.body.indoklas, felh);
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
      return velemenyezes.megjegyzesLetrehozas(req.params.id, req.params.v, req.body, felh);
    },
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
    // Publikus olvasás: hogy a beágyazott <img>/<video> natívan töltsön (auth-fejléc nélkül).
    // Az azonosítók kitalálhatatlanok; éles aláírt URL-ek: Fázis 7.
    { schema: { tags: ['mellékletek'], params: MidParam } },
    async (req, reply) => {
      const t = await melleklet.mellekletTartalom(
        app.tarhely,
        req.params.id,
        req.params.v,
        req.params.mid,
      );
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
}
