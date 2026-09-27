import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildApp } from '../app.js';
import { seedAdatbazis } from '../seed/seed.js';
import { Elem, AuditBejegyzes, Ertesites } from '../db/modellek.js';
import { MemoriaKuldo } from '../ertesites/email.js';

let replset: MongoMemoryReplSet;
let app: FastifyInstance;
let posta: MemoriaKuldo;

const ANNA = 'kiss.anna@pelda.hu'; // Szerző @ 3R
const PETER = 'nagy.peter@pelda.hu'; // globális Admin
const DORA = 'varga.dora@pelda.hu'; // Szerző @ Terminus

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replset.getUri(), { directConnection: true });
  posta = new MemoriaKuldo();
  app = await buildApp({ emailKuldo: posta });
  await app.ready();
  await Elem.init(); // az indexek (köztük a text index) felépülésének bevárása
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
    // azonos típusú (TUS) elemek között, alkalmazásközi — mindkét véget olvasó felhasználóval
    const forras = await idByKulcs('3R-FE-TUS-002');
    const cel = await idByKulcs('Terminus-TAPI-TUS-001');
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: PETER,
      body: { forrasElemId: forras, celElemId: cel, fajta: 'leváltja' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().felajanlElavultat).toBe(true);
  });

  it('nem olvasható cél-elemre nem köthető kapcsolat (404, nem létezés-orákulum)', async () => {
    const forras = await idByKulcs('3R-FE-TUS-002');
    const cel = await idByKulcs('Terminus-TAPI-TUS-001'); // Anna a Terminust nem olvashatja
    const res = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: forras, celElemId: cel, fajta: 'leváltja' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('olvasási hatókör: kapcsolatok, listák', () => {
  it('idegen alkalmazás elemének kapcsolatai 403', async () => {
    const terminus = await idByKulcs('Terminus-TAPI-TUS-001');
    expect((await hiv('GET', `/api/elemek/${terminus}/kapcsolatok`, { mint: ANNA })).statusCode).toBe(403);
  });

  it('az alkalmazásközi kapcsolat a nem olvasható oldalon hivatkozás-csonk', async () => {
    const r3 = await idByKulcs('3R-FE-TUS-002');
    const term = await idByKulcs('Terminus-TAPI-TUS-001');
    const k = await hiv('POST', '/api/kapcsolatok', {
      mint: PETER,
      body: { forrasElemId: r3, celElemId: term, fajta: 'függ tőle' },
    });
    expect(k.statusCode).toBe(201);
    const kid = k.json().kapcsolat.id as string;

    // Anna (3R): a kimenő kapcsolat látszik, de a Terminus-oldali azonosító nem.
    const anna = (await hiv('GET', `/api/elemek/${r3}/kapcsolatok`, { mint: ANNA })).json();
    const annaK = anna.kimeno.find((x: { id: string }) => x.id === kid);
    expect(annaK).toMatchObject({ csonk: true, celElemId: null, fajta: 'függ tőle' });

    // Dóra (Terminus): a bejövő kapcsolat forrása rejtett.
    const dora = (await hiv('GET', `/api/elemek/${term}/kapcsolatok`, { mint: DORA })).json();
    expect(dora.bejovo.find((x: { id: string }) => x.id === kid)).toMatchObject({ csonk: true, forrasElemId: null });

    // Péter (globális Admin): teljes kapcsolat.
    const peter = (await hiv('GET', `/api/elemek/${r3}/kapcsolatok`, { mint: PETER })).json();
    const peterK = peter.kimeno.find((x: { id: string }) => x.id === kid);
    expect(peterK.celElemId).toBe(term);
    expect(peterK.csonk).toBeUndefined();
  });

  it('az alkalmazás- és szolgáltatáslista tagság szerint szűr', async () => {
    const annaAlk = (await hiv('GET', '/api/alkalmazasok', { mint: ANNA })).json() as { kod: string }[];
    expect(annaAlk.map((a) => a.kod)).toEqual(['3R']);
    const peterAlk = (await hiv('GET', '/api/alkalmazasok', { mint: PETER })).json() as { kod: string }[];
    expect(peterAlk.map((a) => a.kod).sort()).toEqual(['3R', 'Terminus']);
    const annaSzolg = (await hiv('GET', '/api/szolgaltatasok', { mint: ANNA })).json() as { kod: string }[];
    expect(annaSzolg.map((s) => s.kod)).toEqual(['FAIR']);
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

describe('válasz-szerződés', () => {
  it('típusmezők nélkül létrehozott elemnél is objektum a tipusMezok (a felület erre épít)', async () => {
    // Regresszió: a Mongoose az üres objektumot mentéskor elhagyja → a kartoték-nézet
    // `tm.rovid` olvasása elszállt (üres oldal) minden frissen létrehozott elemnél.
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Szerződés-teszt', leirasMd: 'x' },
    });
    expect(letre.json().verziok[0].tipusMezok).toEqual({});
    const reszlet = await hiv('GET', `/api/elemek/${letre.json().id}`, { mint: ANNA });
    expect(reszlet.json().verziok[0].tipusMezok).toEqual({});
  });
});

describe('jogi zárolás (legal hold)', () => {
  const OK = 'Hatósági megkeresés 2026/17';
  const zarol = (id: string, aktiv: boolean, mint = PETER) =>
    hiv('POST', `/api/elemek/${id}/jogi-zarolas`, { mint, body: { aktiv, ok: OK } });
  const ujVazlat = async () =>
    (
      await hiv('POST', '/api/elemek', {
        mint: ANNA,
        body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Zárolás-teszt', leirasMd: 'x' },
      })
    ).json().id as string;

  it('csak globális Admin rendelheti el, indoklással; kettős elrendelés 409', async () => {
    const id = await ujVazlat();
    expect((await zarol(id, true, ANNA)).statusCode).toBe(403);
    expect(
      (await hiv('POST', `/api/elemek/${id}/jogi-zarolas`, { mint: PETER, body: { aktiv: true, ok: ' ' } }))
        .statusCode,
    ).toBe(400);
    const r = await zarol(id, true);
    expect(r.statusCode).toBe(200);
    expect(r.json().jogiZarolas).toMatchObject({ aktiv: true, ok: OK, kiNev: 'Nagy Péter' });
    expect(r.json().jogiZarolasNaplo).toHaveLength(1);
    expect((await zarol(id, true)).statusCode).toBe(409);
  });

  it('zárolás alatt a lezáró/eltávolító műveletek 409, a tartalmi munka mehet; feloldás után engedett', async () => {
    const id = await ujVazlat();
    const k = await hiv('POST', '/api/kapcsolatok', {
      mint: ANNA,
      body: { forrasElemId: id, celKulsoLink: 'https://pelda.hu/rendelet', fajta: 'hivatkozik' },
    });
    const kid = k.json().kapcsolat.id as string;
    expect((await zarol(id, true)).statusCode).toBe(200);

    // Tartalmi munka engedett.
    expect((await hiv('PATCH', `/api/elemek/${id}/verziok/1`, { mint: ANNA, body: { cim: 'Módosítva' } })).statusCode).toBe(200);

    // Lezáró / eltávolító műveletek tiltottak.
    expect((await hiv('POST', `/api/elemek/${id}/verziok/1/elvetes`, { mint: ANNA, body: {} })).statusCode).toBe(409);
    expect((await hiv('DELETE', `/api/kapcsolatok/${kid}`, { mint: ANNA })).statusCode).toBe(409);
    expect((await hiv('DELETE', `/api/elemek/${id}`, { mint: PETER })).statusCode).toBe(409);
    const elo = (await hiv('GET', `/api/elemek/${id}/torolheto`, { mint: PETER })).json();
    expect(elo.torolheto).toBe(false);
    expect(elo.okok.join(' ')).toContain('Jogi zárolás');
    expect(elo.ajanlott).toBeNull(); // az elvetés/archiválás is tiltott → nincs mit ajánlani

    // Feloldás után minden újra engedett; a napló mindkét lépést őrzi.
    const fel = await zarol(id, false);
    expect(fel.json().jogiZarolas).toBeNull();
    expect(fel.json().jogiZarolasNaplo.map((n: { muvelet: string }) => n.muvelet)).toEqual(['elrendelés', 'feloldás']);
    expect((await hiv('DELETE', `/api/kapcsolatok/${kid}`, { mint: ANNA })).statusCode).toBe(204);
    expect((await hiv('DELETE', `/api/elemek/${id}`, { mint: PETER })).statusCode).toBe(204);
  });
});

describe('értesítések (felület + e-mail)', () => {
  type E = { id: string; esemeny: string; elemKulcs: string; uzenet: string; olvasva: string | null };
  const sajat = async (mint: string) =>
    (await hiv('GET', '/api/ertesitesek', { mint })).json() as { ertesitesek: E[]; olvasatlan: number };

  async function vazlatBekuldve(): Promise<{ id: string; kulcs: string }> {
    const r = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Értesítés-teszt', leirasMd: 'tartalom' },
    });
    const { id, kulcs } = r.json();
    expect((await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, { mint: ANNA })).statusCode).toBe(200);
    return { id, kulcs };
  }

  it('beküldés → a döntéshozó kap felületi és e-mail értesítést, a beküldő és a többi szerző nem', async () => {
    await Ertesites.deleteMany({});
    posta.levelek.length = 0;
    const { kulcs } = await vazlatBekuldve();
    await app.ertesito.flush();

    // A 3R-nek nincs Jóváhagyója/Adminja → a globális Admin (Péter) kapja.
    const peter = await sajat(PETER);
    expect(peter.ertesitesek[0]).toMatchObject({ esemeny: 'bekuldes', elemKulcs: kulcs });
    expect(peter.olvasatlan).toBe(1);
    expect((await sajat(ANNA)).ertesitesek).toHaveLength(0);
    expect((await sajat('szabo.julia@pelda.hu')).ertesitesek).toHaveLength(0);

    expect(posta.levelek).toHaveLength(1);
    expect(posta.levelek[0]).toMatchObject({ cimzett: PETER, targy: `Véleményezésre vár: ${kulcs} v1` });
    expect(posta.levelek[0]!.szoveg).toMatch(/\/elem\/[0-9a-f]{24}/);
  });

  it('visszadobás → a szerző kapja az indoklással; újrabeküldéskor a bíráló ismét értesül', async () => {
    await Ertesites.deleteMany({});
    const { id } = await vazlatBekuldve();
    await hiv('POST', `/api/elemek/${id}/verziok/1/visszadobas`, {
      mint: PETER,
      body: { indoklas: 'Hiányzik az elfogadási feltétel.' },
    });
    await app.ertesito.flush();
    const anna = await sajat(ANNA);
    expect(anna.ertesitesek[0]).toMatchObject({ esemeny: 'visszadobas' });
    expect(anna.ertesitesek[0]!.uzenet).toContain('Hiányzik az elfogadási feltétel.');

    // Regresszió: a visszadobás „→ Vázlat" naplóbejegyzése miatt a bíráló NEM lehet szerző.
    await Ertesites.deleteMany({});
    await hiv('POST', `/api/elemek/${id}/verziok/1/bekuldes`, { mint: ANNA });
    await app.ertesito.flush();
    expect((await sajat(PETER)).ertesitesek[0]).toMatchObject({ esemeny: 'bekuldes' });
  });

  it('jóváhagyás → a szerző értesül; megjegyzés → a másik fél; válasz → a szülő szerzője', async () => {
    const { id } = await vazlatBekuldve();
    await Ertesites.deleteMany({});

    const mj = await hiv('POST', `/api/elemek/${id}/verziok/1/megjegyzesek`, {
      mint: PETER,
      body: { szoveg: 'Pontosítsd a határidőt.' },
    });
    await app.ertesito.flush();
    expect((await sajat(ANNA)).ertesitesek[0]).toMatchObject({ esemeny: 'megjegyzes' });

    const mjid = (mj.json().verziok[0].megjegyzesek as { mjid: string }[])[0]!.mjid;
    await hiv('POST', `/api/elemek/${id}/verziok/1/megjegyzesek`, {
      mint: ANNA,
      body: { szoveg: 'Javítottam.', valaszMjid: mjid },
    });
    await app.ertesito.flush();
    expect((await sajat(PETER)).ertesitesek[0]).toMatchObject({ esemeny: 'megjegyzes' });

    await hiv('POST', `/api/elemek/${id}/verziok/1/jovahagyas`, {
      mint: PETER,
      body: { hatalyKezdet: '2030-01-01' },
    });
    await app.ertesito.flush();
    const anna = (await sajat(ANNA)).ertesitesek[0]!;
    expect(anna.esemeny).toBe('jovahagyas');
    expect(anna.uzenet).toContain('2030-01-01');
  });

  it('olvasottra állítás csak a saját értesítésen; üres törzzsel mind', async () => {
    await Ertesites.deleteMany({});
    await vazlatBekuldve();
    await vazlatBekuldve();
    await app.ertesito.flush();
    const peter = await sajat(PETER);
    expect(peter.olvasatlan).toBe(2);

    // Anna nem állíthatja olvasottra Péter értesítését.
    await hiv('POST', '/api/ertesitesek/olvasva', { mint: ANNA, body: { idk: [peter.ertesitesek[0]!.id] } });
    expect((await sajat(PETER)).olvasatlan).toBe(2);

    const egy = await hiv('POST', '/api/ertesitesek/olvasva', {
      mint: PETER,
      body: { idk: [peter.ertesitesek[0]!.id] },
    });
    expect(egy.json().olvasatlan).toBe(1);
    const mind = await hiv('POST', '/api/ertesitesek/olvasva', { mint: PETER, body: {} });
    expect(mind.json().olvasatlan).toBe(0);
  });
});

describe('export (CSV, ReqIF)', () => {
  it('CSV: letölthető, BOM-os, hatókörös; minden elem egy sor', async () => {
    const r = await hiv('GET', '/api/export/csv?alkalmazasKod=3R', { mint: ANNA });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toMatch(/attachment; filename="kartotek-3R-legujabb-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(r.body.startsWith('﻿Kulcs;')).toBe(true);
    const osszes = Number((await hiv('GET', '/api/elemek?alkalmazasKod=3R', { mint: ANNA })).headers['x-osszes']);
    expect(r.body.trim().split('\r\n')).toHaveLength(1 + osszes);
    expect(r.body).toContain('3R-BUS-001');
  });

  it('hatályos módban csak a Hatályos verzióval bíró elemek', async () => {
    const leg = (await hiv('GET', '/api/export/csv?alkalmazasKod=3R', { mint: ANNA })).body;
    const hat = (await hiv('GET', '/api/export/csv?alkalmazasKod=3R&mod=hatalyos', { mint: ANNA })).body;
    const sorok = (s: string) => s.trim().split('\r\n').length - 1;
    expect(sorok(hat)).toBeLessThan(sorok(leg));
    expect(hat.trim().split('\r\n').slice(1).every((s) => s.includes(';Hatályos;'))).toBe(true);
  });

  it('ReqIF: minden elem SPEC-OBJECT, a lebontás hierarchia, a belső kapcsolatok relációk', async () => {
    const r = await hiv('GET', '/api/export/reqif?alkalmazasKod=3R', { mint: ANNA });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('application/xml');
    const xml = r.body;
    expect(xml).toContain('<REQ-IF xmlns="http://www.omg.org/spec/ReqIF/20110401/reqif.xsd"');
    const csv = (await hiv('GET', '/api/export/csv?alkalmazasKod=3R', { mint: ANNA })).body;
    const elemDb = csv.trim().split('\r\n').length - 1;
    expect([...xml.matchAll(/<SPEC-OBJECT /g)]).toHaveLength(elemDb);
    expect([...xml.matchAll(/<SPEC-HIERARCHY /g)]).toHaveLength(elemDb); // mindenki pontosan egyszer
    expect(xml).toContain('LONG-NAME="lebontja"');
  });

  it('idegen alkalmazás exportja 403, ismeretlené 404, bejelentkezés nélkül 401', async () => {
    expect((await hiv('GET', '/api/export/csv?alkalmazasKod=Terminus', { mint: ANNA })).statusCode).toBe(403);
    expect((await hiv('GET', '/api/export/reqif?alkalmazasKod=NINCS', { mint: PETER })).statusCode).toBe(404);
    expect((await hiv('GET', '/api/export/csv?alkalmazasKod=3R')).statusCode).toBe(401);
  });
});

describe('teljes szövegű keresés', () => {
  type Lista = { id: string; kulcs: string }[];
  const keres = async (mint: string, szo: string) =>
    ((await hiv('GET', `/api/elemek?kereses=${encodeURIComponent(szo)}`, { mint })).json() as Lista).map(
      (e) => e.kulcs,
    );

  it('a leírás tartalmában is keres (nem csak kulcs/cím/címke)', async () => {
    // „hostess" csak a 3R-BUS-001 részletes leírásában szerepel
    expect(await keres(ANNA, 'hostess')).toEqual(['3R-BUS-001']);
  });

  it('a kulcsban részszóra is illeszt (gépelés közben)', async () => {
    const t = await keres(ANNA, '3R-BU');
    expect(t).toContain('3R-BUS-001');
    expect(t).toContain('3R-BUS-002');
  });

  it('a gazdag (TipTap) tartalmat mentés után megtalálja, a régi szöveget már nem', async () => {
    const letre = await hiv('POST', '/api/elemek', {
      mint: ANNA,
      body: { alkalmazasKod: '3R', tipusKod: 'BUS', cim: 'Keresés-teszt', leirasMd: 'kezdeti' },
    });
    const id = letre.json().id as string;
    const leiras = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A zebraszinkron modul kezeli.' }] }],
    };
    expect((await hiv('PATCH', `/api/elemek/${id}/verziok/1`, { mint: ANNA, body: { leiras } })).statusCode).toBe(200);
    expect(await keres(ANNA, 'zebraszinkron')).toContain(letre.json().kulcs);
    expect(await keres(ANNA, 'kezdeti')).not.toContain(letre.json().kulcs);
  });

  it('a hatókörön kívüli találat nem jön vissza', async () => {
    expect(await keres(DORA, 'hostess')).toEqual([]); // Dóra a 3R-t nem olvashatja
  });

  it('a pótlás a mező nélküli régi verziókat kereshetővé teszi', async () => {
    const id = await idByKulcs('3R-BUS-001');
    await Elem.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $unset: { 'verziok.$[].keresoSzoveg': '' } },
    );
    const { keresoSzovegPotlas } = await import('../db/migraciok.js');
    expect(await keresoSzovegPotlas(app.log)).toBeGreaterThanOrEqual(1);
    expect(await keres(ANNA, 'hostess')).toEqual(['3R-BUS-001']);
  });

  it('nem látható alkalmazásra szűrve üres (nem a többi alkalmazás elemei)', async () => {
    const r = await hiv('GET', '/api/elemek?alkalmazasKod=Terminus', { mint: ANNA });
    expect(r.json()).toEqual([]);
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
  it('globális Adminnak a lista a szerepköröket is visszaadja', async () => {
    const lista = (await hiv('GET', '/api/felhasznalok', { mint: PETER })).json() as {
      email: string;
      tagsagok: { alkalmazasKod: string; szerepkor: string }[];
      globalisAdmin: boolean;
    }[];
    const peter = lista.find((u) => u.email === 'nagy.peter@pelda.hu');
    expect(peter?.globalisAdmin).toBe(true);
  });

  it('nem-adminnak csak azonosító + név (nincs e-mail, szerepkör, admin-jelző)', async () => {
    const lista = (await hiv('GET', '/api/felhasznalok', { mint: ANNA })).json() as Record<string, unknown>[];
    expect(lista.length).toBeGreaterThan(0);
    for (const u of lista) expect(Object.keys(u).sort()).toEqual(['id', 'nev']);
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
