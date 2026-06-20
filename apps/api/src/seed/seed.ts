import { Types } from 'mongoose';
import { elemezKulcs, type Statusz, type TipusKod, type RetegKod } from '@kartotek/shared';
import {
  Alkalmazas,
  Elem,
  Felhasznalo,
  Kapcsolat,
  Kiadas,
  Reteg,
  Szabalyzat,
  Szolgaltatas,
  Tipus,
} from '../db/modellek.js';
import {
  ALKALMAZASOK,
  ELEMEK,
  FELHASZNALOK,
  KAPCSOLATOK,
  SZABALYZATOK,
  SZABALYZAT_KODOK,
  SZOLGALTATAS,
  type NyersMelleklet,
  type NyersNaplo,
  type NyersVerzio,
} from './prototipus-adatok.js';

const TIPUS_NEVEK: Record<string, { nev: string; uzleti: boolean }> = {
  BUS: { nev: 'Üzleti User Story', uzleti: true },
  TUC: { nev: 'Technikai Use Case', uzleti: false },
  F: { nev: 'Feature', uzleti: false },
  TUS: { nev: 'Technikai User Story', uzleti: false },
  BD: { nev: 'Üzleti dokumentum', uzleti: true },
  TD: { nev: 'Technikai dokumentum', uzleti: false },
};

const RETEG_NEVEK: Record<string, string> = {
  FE: 'Frontend',
  Core: 'Core',
  TAPI: 'Technikai API',
  TDB: 'Technikai adatbázis',
};

const d = (s: string | null): Date | null => (s ? new Date(s) : null);

export interface SeedEredmeny {
  felhasznalok: number;
  szolgaltatasok: number;
  alkalmazasok: number;
  szabalyzatok: number;
  elemek: number;
  kapcsolatok: number;
}

/** Kiüríti a kollekciókat és betölti a prototípus példaadatait. */
export async function seedAdatbazis(): Promise<SeedEredmeny> {
  await Promise.all([
    Felhasznalo.deleteMany({}),
    Szolgaltatas.deleteMany({}),
    Alkalmazas.deleteMany({}),
    Szabalyzat.deleteMany({}),
    Elem.deleteMany({}),
    Kapcsolat.deleteMany({}),
    Kiadas.deleteMany({}),
    Tipus.deleteMany({}),
    Reteg.deleteMany({}),
  ]);

  // Referenciaadatok.
  await Tipus.insertMany(
    Object.entries(TIPUS_NEVEK).map(([kod, t]) => ({ kod, nev: t.nev, uzleti: t.uzleti })),
  );
  await Reteg.insertMany(Object.entries(RETEG_NEVEK).map(([kod, nev]) => ({ kod, nev })));
  await Szabalyzat.insertMany(SZABALYZATOK.map((s) => ({ kod: s.kod, nev: s.nev, url: s.url })));

  // Felhasználók — név → _id térkép a hivatkozásokhoz.
  const userId = new Map<string, Types.ObjectId>();
  const felhDocs = FELHASZNALOK.map((f) => {
    const _id = new Types.ObjectId();
    userId.set(f.nev, _id);
    return {
      _id,
      nev: f.nev,
      email: f.email,
      globalisAdmin: f.globalisAdmin,
      tagsagok: f.tagsagok.map((t) => ({ ...t })),
    };
  });
  await Felhasznalo.insertMany(felhDocs);

  // Szolgáltatás + alkalmazások.
  await Szolgaltatas.create({
    kod: SZOLGALTATAS.kod,
    nev: SZOLGALTATAS.nev,
    leiras: SZOLGALTATAS.leiras,
    gazdaId: userId.get(SZOLGALTATAS.gazda) ?? null,
  });
  await Alkalmazas.insertMany(
    ALKALMAZASOK.map((a) => ({
      kod: a.kod,
      nev: a.nev,
      leiras: a.leiras,
      szolgaltatasKod: a.szolgaltatasKod,
    })),
  );

  // A `ki` mező feloldása: 'RENDSZER' marad, egyébként a felhasználó _id sztringje.
  const kiId = (nev: string): string =>
    nev === 'RENDSZER' ? 'RENDSZER' : (userId.get(nev)?.toString() ?? nev);

  const naploMap = (n: NyersNaplo) => ({
    ...(n.honnan ? { honnan: n.honnan as Statusz } : {}),
    hova: n.hova as Statusz,
    mikor: new Date(n.mikor),
    ki: kiId(n.ki),
    ...(n.megj ? { indoklas: n.megj } : {}),
  });

  const mellekletMap = (m: NyersMelleklet) => ({
    mid: m.mid,
    tipus: m.tipus,
    alt: m.alt,
    tartalomHiv: m.tartalomHiv,
    ...(m.figmaPng ? { figmaPng: m.figmaPng } : {}),
    ...(m.figmaLink ? { figmaLink: m.figmaLink } : {}),
  });

  const verzioMap = (cim: string, v: NyersVerzio) => ({
    verzioSzam: v.v,
    statusz: v.statusz as Statusz,
    cim,
    leirasMd: v.leiras,
    tipusMezok: { rovid: v.rovid, elofeltetelek: v.elofeltetelek, kriteriumok: v.kriteriumok, cia: v.cia },
    hatalyKezdet: d(v.hatalyKezdet),
    hatalyVeg: d(v.hatalyVeg),
    letrehozva: new Date(v.letrehozva),
    modositottaId: userId.get(v.modositotta) ?? new Types.ObjectId(),
    statusznaplo: v.naplo.map(naploMap),
    mellekletek: (v.mellekletek ?? []).map(mellekletMap),
  });

  // Elemek — kulcs → _id térkép a kapcsolatokhoz.
  const elemId = new Map<string, Types.ObjectId>();
  const elemDocs = ELEMEK.map((e) => {
    const _id = new Types.ObjectId();
    elemId.set(e.kulcs, _id);
    const reszek = elemezKulcs(e.kulcs);
    return {
      _id,
      kulcs: e.kulcs,
      tipusKod: e.tipus as TipusKod,
      alkalmazasKod: reszek?.alkKod ?? e.kulcs.split('-')[0]!,
      retegKod: (e.reteg as RetegKod | null) ?? null,
      cimkek: e.tagek,
      verziok: e.verziok.map((v) => verzioMap(e.cim, v)),
    };
  });
  await Elem.insertMany(elemDocs);

  // Kapcsolatok — a cél lehet belső elem vagy szabályzat.
  const kapcsDocs = KAPCSOLATOK.map((k) => {
    const forrasId = elemId.get(k.forras);
    if (!forrasId) throw new Error(`Ismeretlen forrás-elem a seedben: ${k.forras}`);
    if (SZABALYZAT_KODOK.has(k.cel)) {
      return { forrasElemId: forrasId, celSzabalyzatKod: k.cel, fajta: k.fajta };
    }
    const celId = elemId.get(k.cel);
    if (!celId) throw new Error(`Ismeretlen cél-elem a seedben: ${k.cel}`);
    return { forrasElemId: forrasId, celElemId: celId, fajta: k.fajta };
  });
  await Kapcsolat.insertMany(kapcsDocs);

  return {
    felhasznalok: felhDocs.length,
    szolgaltatasok: 1,
    alkalmazasok: ALKALMAZASOK.length,
    szabalyzatok: SZABALYZATOK.length,
    elemek: elemDocs.length,
    kapcsolatok: kapcsDocs.length,
  };
}
