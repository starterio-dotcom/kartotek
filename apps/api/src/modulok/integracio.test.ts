import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildApp } from '../app.js';
import { seedAdatbazis } from '../seed/seed.js';
import { Elem, AuditBejegyzes } from '../db/modellek.js';

let replset: MongoMemoryReplSet;
let app: FastifyInstance;

const ANNA = 'kiss.anna@pelda.hu'; // Szerző @ 3R
const PETER = 'nagy.peter@pelda.hu'; // globális Admin
const DORA = 'varga.dora@pelda.hu'; // Szerző @ Terminus

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri(), { directConnection: true });
  app = await buildApp();
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await mongoose.disconnect();
  await replset?.stop();
});

beforeEach(async () => {
  await seedAdatbazis();
});

function hiv(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  opts: { mint?: string; body?: unknown } = {},
) {
  return app.inject({
    method,
    url,
    headers: opts.mint ? { 'x-felhasznalo-email': opts.mint } : {},
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
}

async function idByKulcs(kulcs: string): Promise<string> {
  const e = await Elem.findOne({ kulcs }).select('_id').lean();
  if (!e) throw new Error(`nincs ilyen elem: ${kulcs}`);
  return String(e._id);
}

describe('auth', () => {
  it('whoami fejléc nélkül 401', async () => {
    expect((await hiv('GET', '/api/auth/en')).statusCode).toBe(401);
  });
  it('whoami fejléccel a felhasználót adja', async () => {
    const res = await hiv('GET', '/api/auth/en', { mint: ANNA });
    expect(res.statusCode).toBe(200);
    expect(res.json().nev).toBe('Kiss Anna');
  });
});

describe('teljes életciklus Vázlat → Archivált', () => {
  it('végigvihető helyes szerepkörökkel és teljes naplóval', async () => {
    // 1) Szerző létrehoz
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Teszt regisztráció', leirasMd: 'Leírás.' },
    });
    expect(letre.statusCode).toBe(201);
    const id = letre.json().id as string;
    expect(letre.json().kulcs).toBe('3R-BUS-003');

    // 2) Beküldés (Szerző)
    expect((await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, { mint: ANNA })).statusCode).toBe(200);

    // 3) Jóváhagyás (globális Admin, NEM a szerző → négy-szem-elv OK)
    const jova = await hiv('POST', `/api/elemek/${id}/verziok/1/jovahagyas`, {
      mint: PETER,
      body: { hatalyKezdet: '2026-07-01' },
    });
    expect(jova.statusCode).toBe(200);
    expect(jova.json().verziok[0].statusz).toBe('Jóváhagyott');

    // 4) Ütemező lépteti Hatályossá
    const ut = await hiv('POST', '/api/utemezo/futtat', { mint: PETER, body: { ma: '2026-07-02' } });
    expect(ut.statusCode).toBe(200);
    expect(ut.json().hatalybalepes).toBeGreaterThanOrEqual(1);

    // 5) Kivezetés (Admin) → Elavult
    expect(
      (await hiv('POST', `/api/elemek/${id}/verziok/1/kivezetes`, {
        mint: PETER,
        body: { hatalyVeg: '2026-08-01' },
      })).statusCode,
    ).toBe(200);

    // 6) Archiválás (Admin) → Archivált
    const arch = await hiv('POST', `/api/elemek/${id}/verziok/1/archivalas`, { mint: PETER });
    expect(arch.statusCode).toBe(200);

    const veg = await hiv('GET', `/api/elemek/${id}`, { mint: PETER });
    const v1 = veg.json().verziok[0];
    expect(v1.statusz).toBe('Archivált');
    expect(v1.statusznaplo.some((n: { ki: string }) => n.ki === 'RENDSZER')).toBe(true);
    expect(v1.statusznaplo.at(-1).hova).toBe('Archivált');
  });
});

describe('tiltott műveletek', () => {
  it('rossz szerepkör: Szerző nem hagyhat jóvá', async () => {
    const id = await idByKulcs('3R-Core-TUS-003'); // Véleményezés
    const res = await hiv('POST', `/api/elemek/${id}/verziok/1/jovahagyas`, {
      mint: ANNA,
      body: { hatalyKezdet: '2026-07-01' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('négy-szem-elv: a szerző (akár globális Admin) nem hagyhatja jóvá a sajátját', async () => {
    const letre = await hiv('POST', '/api/elemek', {
      mint: PETER,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Saját', leirasMd: 'x' },
    });
    const id = letre.json().id as string;
    await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, { mint: PETER });
    const res = await hiv('POST', `/api/elemek/${id}/verziok/1/jovahagyas`, {
      mint: PETER,
      body: { hatalyKezdet: '2026-07-01' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('érvénytelen átmenet: Hatályos verzió nem küldhető be', async () => {
    const id = await idByKulcs('3R-BUS-002'); // v1 Hatályos
    expect((await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, { mint: ANNA })).statusCode).toBe(403);
  });

  it('tartalmi zár: Hatályos verzió nem szerkeszthető (409)', async () => {
    const id = await idByKulcs('3R-BUS-002');
    const res = await hiv('PATCH', `/api/elemek/${id}/verziok/1`, {
      mint: ANNA,
      body: { cim: 'Új cím' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('beküldési validáció: üres leírású Vázlat nem küldhető be', async () => {
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Cím', leirasMd: '' },
    });
    const id = letre.json().id as string;
    const res = await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, { mint: ANNA });
    expect(res.statusCode).toBe(400);
  });
});

describe('kapcsolat CRUD + validáció', () => {
  it('ciklikus lebontja elutasítva', async () => {
    const forras = await idByKulcs('3R-Core-TUS-003');
    const cel = await idByKulcs('3R-BUS-002'); // BUS-002 → … → Core-TUS-003 már elérhető
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: forras, celElemId: cel, fajta: 'lebontja' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('duplikátum elutasítva', async () => {
    const forras = await idByKulcs('3R-BUS-002');
    const cel = await idByKulcs('3R-FE-TUS-002'); // már létezik lebontja
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: forras, celElemId: cel, fajta: 'lebontja' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('cél-megszorítás: megfelel célja nem lehet elem', async () => {
    const forras = await idByKulcs('3R-BUS-002');
    const cel = await idByKulcs('3R-FE-TUS-002');
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: forras, celElemId: cel, fajta: 'megfelel' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('érvényes kapcsolat felvehető és törölhető', async () => {
    const forras = await idByKulcs('3R-FE-TUS-002');
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: forras, celKulsoLink: 'https://pelda.hu/doc', fajta: 'hivatkozik' },
    });
    expect(res.statusCode).toBe(201);
    const kid = res.json().kapcsolat.id as string;
    expect((await hiv('DELETE', `/api/kapcsolatok/${kid}`, { mint: ANNA })).statusCode).toBe(204);
  });

  it('leváltja felvételekor felajánlja az Elavultba léptetést', async () => {
    // azonos típusú (TUS) elemek között
    const forras = await idByKulcs('3R-FE-TUS-002');
    const cel = await idByKulcs('Terminus-TAPI-TUS-001');
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: forras, celElemId: cel, fajta: 'leváltja' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().felajanlElavultat).toBe(true);
  });
});

describe('véleményezési megjegyzések', () => {
  it('felvehető, szálazható és megoldottra állítható', async () => {
    const id = await idByKulcs('3R-Core-TUS-003'); // Véleményezés
    const uj = await hiv('POST', `/api/elemek/${id}/verziok/1/megjegyzesek`, {
      mint: ANNA,
      body: { szoveg: 'Pontosítsd a hibaágat.' },
    });
    expect(uj.statusCode).toBe(201);
    const mjid = uj.json().verziok[0].megjegyzesek[0].mjid as string;

    const valasz = await hiv('POST', `/api/elemek/${id}/verziok/1/megjegyzesek`, {
      mint: ANNA,
      body: { szoveg: 'Javítva.', valaszMjid: mjid },
    });
    expect(valasz.statusCode).toBe(201);

    const megoldva = await hiv(
      'POST',
      `/api/elemek/${id}/verziok/1/megjegyzesek/${mjid}/megoldas`,
      { mint: ANNA },
    );
    expect(megoldva.statusCode).toBe(200);
    const mj = megoldva.json().verziok[0].megjegyzesek.find((m: { mjid: string }) => m.mjid === mjid);
    expect(mj.allapot).toBe('megoldott');
  });
});

describe('optimista zár (verzió-szerkesztés)', () => {
  async function ujVazlat(): Promise<string> {
    const r = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Zár-teszt', leirasMd: 'x' },
    });
    return r.json().id as string;
  }
  const szerk = (id: string, body: object) =>
    hiv('PATCH', `/api/elemek/${id}/verziok/1`, { mint: ANNA, body });

  it('a revízió minden mentéssel nő; elavult alapRevizio → 409', async () => {
    const id = await ujVazlat();
    const elso = await szerk(id, { cim: 'A', alapRevizio: 0 });
    expect(elso.statusCode).toBe(200);
    expect(elso.json().verziok[0].revizio).toBe(1);

    // Egy másik szerkesztő még a 0-s revízióból mentene → ütközés, nincs néma felülírás.
    const elavult = await szerk(id, { cim: 'B', alapRevizio: 0 });
    expect(elavult.statusCode).toBe(409);
    expect(elavult.json().reszletek.aktualisRevizio).toBe(1);
    const most = await hiv('GET', `/api/elemek/${id}`, { mint: ANNA });
    expect(most.json().verziok[0].cim).toBe('A'); // az első mentés megmaradt

    const friss = await szerk(id, { cim: 'C', alapRevizio: 1 });
    expect(friss.statusCode).toBe(200);
    expect(friss.json().verziok[0].revizio).toBe(2);
  });

  it('alapRevizio nélkül is ment (visszafelé kompatibilis)', async () => {
    const id = await ujVazlat();
    const r = await szerk(id, { cim: 'D' });
    expect(r.statusCode).toBe(200);
    expect(r.json().verziok[0].revizio).toBe(1);
  });

  it('párhuzamos mentéseknél nincs elveszett frissítés és nincs 500', async () => {
    const id = await ujVazlat();
    const valaszok = await Promise.all(
      Array.from({ length: 6 }, (_, i) => szerk(id, { cim: `P${i}` })),
    );
    const kodok = valaszok.map((v) => v.statusCode);
    expect(kodok.every((k) => k === 200 || k === 409)).toBe(true);
    const sikeres = kodok.filter((k) => k === 200).length;
    expect(sikeres).toBeGreaterThanOrEqual(1);
    // Invariáns: minden sikeres mentés pontosan egyszer növelt — semmi nem íródott felül.
    const vegso = await hiv('GET', `/api/elemek/${id}`, { mint: ANNA });
    expect(vegso.json().verziok[0].revizio).toBe(sikeres);
  });

  it('két elavult példány közül a második mentése VersionError (modell-szint)', async () => {
    const id = await ujVazlat();
    const a = await Elem.findById(id);
    const b = await Elem.findById(id);
    a!.cimkek = ['a'];
    await a!.save();
    b!.cimkek = ['b'];
    await expect(b!.save()).rejects.toMatchObject({ name: 'VersionError' });
  });
});

describe('elemlista: lapozás + projekció', () => {
  type Lista = { id: string; kulcs: string; verziok: Record<string, unknown>[] }[];

  it('alapból összegző nézet: tartalom, napló, mellékletek nélkül; X-Osszes fejléccel', async () => {
    const r = await hiv('GET', '/api/elemek', { mint: PETER });
    expect(r.statusCode).toBe(200);
    const elemek = r.json() as Lista;
    expect(elemek.length).toBeGreaterThan(0);
    expect(Number(r.headers['x-osszes'])).toBe(elemek.length);
    const v = elemek[0]!.verziok[0]!;
    expect(v).toHaveProperty('statusz');
    expect(v).toHaveProperty('cim');
    expect(v).not.toHaveProperty('leirasMd');
    expect(v).not.toHaveProperty('statusznaplo');
    expect(v).not.toHaveProperty('mellekletek');
  });

  it('a teljes nézet csak alkalmazásra szűrve kérhető, és jóval nagyobb', async () => {
    expect((await hiv('GET', '/api/elemek?nezet=teljes', { mint: PETER })).statusCode).toBe(400);
    const teljes = await hiv('GET', '/api/elemek?nezet=teljes&alkalmazasKod=3R', { mint: PETER });
    expect(teljes.statusCode).toBe(200);
    expect((teljes.json() as Lista)[0]!.verziok[0]).toHaveProperty('leirasMd');
    const osszegzo = await hiv('GET', '/api/elemek?alkalmazasKod=3R', { mint: PETER });
    // A tartalom a méret zöme: az összegző lista töredéke a teljesnek.
    expect(osszegzo.body.length).toBeLessThan(teljes.body.length / 2);
  });

  it('a lapozás stabil és diszjunkt oldalakat ad', async () => {
    const osszes = Number((await hiv('GET', '/api/elemek', { mint: PETER })).headers['x-osszes']);
    const elso = (await hiv('GET', '/api/elemek?limit=2&offset=0', { mint: PETER })).json() as Lista;
    const masodik = await hiv('GET', '/api/elemek?limit=2&offset=2', { mint: PETER });
    const m = masodik.json() as Lista;
    expect(elso).toHaveLength(2);
    expect(Number(masodik.headers['x-osszes'])).toBe(osszes); // az összes a lapozástól független
    const elsoIdk = new Set(elso.map((e) => e.id));
    expect(m.every((e) => !elsoIdk.has(e.id))).toBe(true);
    expect(elso[1]!.kulcs.localeCompare(m[0]!.kulcs)).toBeLessThanOrEqual(0); // kulcs szerint rendezett
  });

  it('a státusz-szűrő a DB-ben fut, és az összes is erre vonatkozik', async () => {
    const r = await hiv('GET', '/api/elemek?statusz=Hat%C3%A1lyos', { mint: PETER });
    const elemek = r.json() as Lista;
    expect(elemek.length).toBeGreaterThan(0);
    expect(Number(r.headers['x-osszes'])).toBe(elemek.length);
    expect(elemek.every((e) => e.verziok.some((v) => v.statusz === 'Hatályos'))).toBe(true);
  });
});

describe('audit-napló', () => {
  async function naplo() {
    await app.auditFlush();
    return AuditBejegyzes.find().sort({ idopont: 1, _id: 1 }).lean();
  }

  it('a módosítást a felhasználóval és eredménnyel rögzíti', async () => {
    await AuditBejegyzes.deleteMany({});
    const r = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Audit-teszt', leirasMd: 'x' },
    });
    expect(r.statusCode).toBe(201);
    const [b] = await naplo();
    expect(b).toMatchObject({
      esemeny: 'modositas',
      email: ANNA,
      metodus: 'POST',
      utvonal: '/api/elemek',
      statusz: 201,
    });
    expect(b!.ip).toBeTruthy();
  });

  it('az elutasított hozzáférést (403, 401) rögzíti — névtelenül is', async () => {
    await AuditBejegyzes.deleteMany({});
    const id = await idByKulcs('3R-BUS-002');
    expect((await hiv('GET', `/api/elemek/${id}`, { mint: DORA })).statusCode).toBe(403);
    expect((await hiv('GET', '/api/elemek')).statusCode).toBe(401);
    const bejegyzesek = await naplo();
    expect(bejegyzesek).toHaveLength(2);
    expect(bejegyzesek[0]).toMatchObject({
      esemeny: 'hozzaferes-megtagadva',
      email: DORA,
      elemId: id,
      statusz: 403,
    });
    expect(bejegyzesek[1]).toMatchObject({ esemeny: 'hozzaferes-megtagadva', felhasznaloId: null, statusz: 401 });
  });

  it('az érzékeny olvasást naplózza, a közönséges listát és a /health-et nem', async () => {
    await AuditBejegyzes.deleteMany({});
    const id = await idByKulcs('3R-BUS-002');
    expect((await hiv('GET', `/api/elemek/${id}`, { mint: ANNA })).statusCode).toBe(200);
    expect((await hiv('GET', '/api/elemek', { mint: ANNA })).statusCode).toBe(200);
    expect((await hiv('GET', '/api/szolgaltatasok', { mint: ANNA })).statusCode).toBe(200);
    expect((await hiv('GET', '/health')).statusCode).toBe(200);
    const bejegyzesek = await naplo();
    expect(bejegyzesek).toHaveLength(1);
    expect(bejegyzesek[0]).toMatchObject({ esemeny: 'olvasas', elemId: id, utvonal: '/api/elemek/:id' });
  });

  it('a query-stringet sosem tárolja (pl. aláírt URL sig-je)', async () => {
    await AuditBejegyzes.deleteMany({});
    const id = await idByKulcs('3R-BUS-002');
    await hiv('GET', `/api/elemek/${id}?sig=TITKOS-TOKEN`, { mint: ANNA });
    const [b] = await naplo();
    expect(b!.ut).toBe(`/api/elemek/${id}`);
    expect(JSON.stringify(b)).not.toContain('TITKOS-TOKEN');
  });

  it('a lekérdező végpont csak globális Adminnak elérhető, szűrhető', async () => {
    await AuditBejegyzes.deleteMany({});
    await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Szűrés', leirasMd: 'x' },
    });
    await app.auditFlush();
    expect((await hiv('GET', '/api/audit', { mint: ANNA })).statusCode).toBe(403);

    const r = await hiv('GET', `/api/audit?felhasznalo=${encodeURIComponent(ANNA)}&esemeny=modositas`, {
      mint: PETER,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.osszes).toBe(1);
    expect(body.bejegyzesek[0]).toMatchObject({ email: ANNA, utvonal: '/api/elemek', statusz: 201 });
  });
});

describe('ütemező idempotencia', () => {
  it('másodszorra nincs új átmenet', async () => {
    const elso = await hiv('POST', '/api/utemezo/futtat', { mint: PETER, body: { ma: '2027-01-01' } });
    expect(elso.statusCode).toBe(200);
    expect(elso.json().valtozas).toBeGreaterThan(0);
    const masodik = await hiv('POST', '/api/utemezo/futtat', { mint: PETER, body: { ma: '2027-01-01' } });
    expect(masodik.json().valtozas).toBe(0);
  });

  it('az ütemezőt csak globális Admin indíthatja', async () => {
    expect((await hiv('POST', '/api/utemezo/futtat', { mint: DORA, body: {} })).statusCode).toBe(403);
  });
});

describe('felhasználók + gazdag tartalom', () => {
  it('a felhasználólista nevet ad (a megjegyzés-szerző feloldásához)', async () => {
    const res = await hiv('GET', '/api/felhasznalok', { mint: ANNA });
    expect(res.statusCode).toBe(200);
    const lista = res.json() as { nev: string }[];
    expect(lista.some((f) => f.nev === 'Kiss Anna')).toBe(true);
  });

  it('a verzió gazdag (JSON) leírása elmenthető és visszajön', async () => {
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Gazdag', leirasMd: 'x' },
    });
    const id = letre.json().id as string;
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Helló' }] }] };
    const res = await hiv('PATCH', `/api/elemek/${id}/verziok/1`, { mint: ANNA, body: { leiras: doc } });
    expect(res.statusCode).toBe(200);
    expect(res.json().verziok[0].leiras).toEqual(doc);
  });
});

describe('címke- és szervezet-szerkesztés', () => {
  it('a címke állapottól függetlenül szerkeszthető (Hatályos elemen is)', async () => {
    const id = await idByKulcs('3R-BUS-002'); // v1 Hatályos
    const res = await hiv('PATCH', `/api/elemek/${id}/cimkek`, {
      mint: ANNA,
      body: { cimkek: ['regisztráció', 'új-címke'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cimkek).toContain('új-címke');
  });

  it('Olvasó/idegen nem szerkeszthet címkét', async () => {
    const id = await idByKulcs('3R-BUS-002');
    expect(
      (await hiv('PATCH', `/api/elemek/${id}/cimkek`, { mint: DORA, body: { cimkek: ['x'] } })).statusCode,
    ).toBe(403);
  });

  it('szolgáltatás metaadat csak globális Adminnak', async () => {
    expect(
      (await hiv('PATCH', '/api/szolgaltatasok/FAIR', { mint: PETER, body: { leiras: 'frissítve' } })).statusCode,
    ).toBe(200);
    expect(
      (await hiv('PATCH', '/api/szolgaltatasok/FAIR', { mint: ANNA, body: { leiras: 'x' } })).statusCode,
    ).toBe(403);
  });
});

describe('kapcsolati gráf', () => {
  it('a 3R gráf csomópontokat, éleket és szabályzat-célt ad', async () => {
    const res = await hiv('GET', '/api/graf?alkalmazasKod=3R', { mint: ANNA });
    expect(res.statusCode).toBe(200);
    const g = res.json();
    // 3R elemek: BUS-001, BUS-002, TUC-001, F-001, FE-TUS-002, Core-TUS-003, BD-001
    expect(g.csomopontok).toHaveLength(7);
    expect(g.szabalyzatok).toContain('IB-XYT-14-1213');
    // megfelel-él a szabályzatra
    expect(g.elek.some((e: { cel: string; fajta: string }) => e.cel === 'sz:IB-XYT-14-1213' && e.fajta === 'megfelel')).toBe(true);
    // lebontja-élek a 3R-en belül
    expect(g.elek.filter((e: { fajta: string }) => e.fajta === 'lebontja').length).toBeGreaterThanOrEqual(3);
  });

  it('a hatókörön kívüli alkalmazás gráfja tiltott', async () => {
    expect((await hiv('GET', '/api/graf?alkalmazasKod=3R', { mint: DORA })).statusCode).toBe(403);
  });
});

describe('olvasási hatókör', () => {
  it('Terminus Szerző nem látja a 3R-elem részleteit', async () => {
    const id = await idByKulcs('3R-BUS-002');
    expect((await hiv('GET', `/api/elemek/${id}`, { mint: DORA })).statusCode).toBe(403);
    // a saját alkalmazását igen
    const sajat = await idByKulcs('Terminus-TDB-TD-001');
    expect((await hiv('GET', `/api/elemek/${sajat}`, { mint: DORA })).statusCode).toBe(200);
  });

  it('a lista a hatókörre szűr', async () => {
    const res = await hiv('GET', '/api/elemek', { mint: DORA });
    const kodok = new Set((res.json() as { alkalmazasKod: string }[]).map((e) => e.alkalmazasKod));
    expect(kodok.has('Terminus')).toBe(true);
    expect(kodok.has('3R')).toBe(false);
  });
});

describe('törlés-őr (Fázis 6)', () => {
  it('sosem hivatkozott Vázlat törölhető (Admin)', async () => {
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Eldobható', leirasMd: 'x' },
    });
    const id = letre.json().id as string;
    const pre = await hiv('GET', `/api/elemek/${id}/torolheto`, { mint: PETER });
    expect(pre.json().torolheto).toBe(true);
    expect((await hiv('DELETE', `/api/elemek/${id}`, { mint: PETER })).statusCode).toBe(204);
    expect((await hiv('GET', `/api/elemek/${id}`, { mint: PETER })).statusCode).toBe(404);
  });

  it('Hatályos elem fizikailag nem törölhető, archiválást ajánl', async () => {
    const id = await idByKulcs('3R-BUS-002');
    const pre = await hiv('GET', `/api/elemek/${id}/torolheto`, { mint: PETER });
    expect(pre.json().torolheto).toBe(false);
    expect(pre.json().ajanlott).toBe('archiválás');
    expect((await hiv('DELETE', `/api/elemek/${id}`, { mint: PETER })).statusCode).toBe(409);
  });

  it('kapcsolattal rendelkező Vázlat nem törölhető, elvetést ajánl', async () => {
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Kapcsolt vázlat', leirasMd: 'x' },
    });
    const id = letre.json().id as string;
    // Kimenő hivatkozás → már nem „sosem hivatkozott”.
    await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: id, celKulsoLink: 'https://pelda.hu/x', fajta: 'hivatkozik' },
    });
    const pre = await hiv('GET', `/api/elemek/${id}/torolheto`, { mint: PETER });
    expect(pre.json().torolheto).toBe(false);
    expect(pre.json().ajanlott).toBe('elvetés');
  });

  it('csak Admin törölhet (Olvasó/idegen 403)', async () => {
    const id = await idByKulcs('Terminus-TDB-TD-001');
    expect((await hiv('DELETE', `/api/elemek/${id}`, { mint: ANNA })).statusCode).toBe(403);
  });
});

describe('riportok (Fázis 6)', () => {
  it('lefedettség: a 3R-BUS-001-nek nincs TUS-a (fedetlen)', async () => {
    const res = await hiv('GET', '/api/riportok/lefedettseg?alkalmazasKod=3R', { mint: ANNA });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.osszesBus).toBe(2);
    const kulcsok = (r.fedetlenek as { kulcs: string }[]).map((e) => e.kulcs);
    expect(kulcsok).toContain('3R-BUS-001');
    expect(kulcsok).not.toContain('3R-BUS-002');
  });

  it('megfelelés: az IB-XYT-14-1213 szabályzatnak van megfelelő eleme', async () => {
    const res = await hiv('GET', '/api/riportok/megfeleles?alkalmazasKod=3R', { mint: ANNA });
    expect(res.statusCode).toBe(200);
    const tetel = (res.json() as { kod: string; megfelelok: { kulcs: string }[] }[]).find(
      (t) => t.kod === 'IB-XYT-14-1213',
    );
    expect(tetel?.megfelelok.map((m) => m.kulcs)).toContain('3R-Core-TUS-003');
  });

  it('hatáselemzés: a BUS-002 lefelé eléri a TUS-okat, a hatókörön kívülit nem', async () => {
    const id = await idByKulcs('3R-BUS-002');
    const res = await hiv('GET', `/api/elemek/${id}/hatas`, { mint: ANNA });
    expect(res.statusCode).toBe(200);
    const lefeleKulcsok = (res.json().lefele as { kulcs: string }[]).map((e) => e.kulcs);
    expect(lefeleKulcsok).toContain('3R-FE-TUS-002');
    expect(lefeleKulcsok).toContain('3R-Core-TUS-003');
    expect(lefeleKulcsok.some((k) => k.startsWith('Terminus'))).toBe(false);
  });
});

describe('kiadások (Fázis 6)', () => {
  it('kiadás létrehozható (Admin), idegen nem hozhat létre', async () => {
    expect(
      (await hiv('POST', '/api/kiadasok', { mint: DORA, body: { verzio: 'R9', datum: '2026-09-01' } }))
        .statusCode,
    ).toBe(403);
    const ok = await hiv('POST', '/api/kiadasok', {
      mint: PETER,
      body: { verzio: 'R9', datum: '2026-09-01' },
    });
    expect(ok.statusCode).toBe(201);
  });

  it('verzió kiadáshoz rendelhető, és a kiadás tartalma listázza', async () => {
    const k = await hiv('POST', '/api/kiadasok', {
      mint: PETER,
      body: { verzio: 'R10', datum: '2026-10-01' },
    });
    const kiadasId = k.json().id as string;
    const id = await idByKulcs('3R-BUS-002');
    const hozza = await hiv('POST', `/api/elemek/${id}/verziok/1/kiadas`, {
      mint: ANNA,
      body: { kiadasId, hozzarendel: true },
    });
    expect(hozza.statusCode).toBe(200);

    const tart = await hiv('GET', `/api/kiadasok/${kiadasId}/tartalom`, { mint: ANNA });
    expect(tart.statusCode).toBe(200);
    const verziok = tart.json().verziok as { kulcs: string; verzioSzam: number }[];
    expect(verziok.some((v) => v.kulcs === '3R-BUS-002' && v.verzioSzam === 1)).toBe(true);

    // Leválasztás után üres.
    await hiv('POST', `/api/elemek/${id}/verziok/1/kiadas`, {
      mint: ANNA,
      body: { kiadasId, hozzarendel: false },
    });
    const ures = await hiv('GET', `/api/kiadasok/${kiadasId}/tartalom`, { mint: ANNA });
    expect((ures.json().verziok as unknown[]).length).toBe(0);
  });
});

describe('felhasználó-szerepkörök kezelése (admin)', () => {
  it('a lista a szerepköröket is visszaadja', async () => {
    const lista = (await hiv('GET', '/api/felhasznalok', { mint: ANNA })).json() as {
      email: string;
      tagsagok: { alkalmazasKod: string; szerepkor: string }[];
      globalisAdmin: boolean;
    }[];
    const peter = lista.find((u) => u.email === 'nagy.peter@pelda.hu');
    expect(peter?.globalisAdmin).toBe(true);
  });

  it('globális Admin frissítheti a tagságokat, idegen 403', async () => {
    const lista = (await hiv('GET', '/api/felhasznalok', { mint: PETER })).json() as {
      id: string;
      email: string;
    }[];
    const dora = lista.find((u) => u.email === 'varga.dora@pelda.hu')!;

    // Nem globális Admin → 403.
    expect(
      (await hiv('PATCH', `/api/felhasznalok/${dora.id}`, {
        mint: ANNA,
        body: { globalisAdmin: true },
      })).statusCode,
    ).toBe(403);

    // Globális Admin → 200, +3R Olvasó tagság.
    const res = await hiv('PATCH', `/api/felhasznalok/${dora.id}`, {
      mint: PETER,
      body: {
        tagsagok: [
          { alkalmazasKod: 'Terminus', szerepkor: 'Szerző' },
          { alkalmazasKod: '3R', szerepkor: 'Olvasó' },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().tagsagok as unknown[]).length).toBe(2);
  });
});
