import type { Jovahagyas, VerzioSzerkesztes } from '@kartotek/shared';
import { hiba400, hiba409 } from '../../hibak.js';
import { ellenoriz, verzioCtx, vanUjabbAktivVerzio } from '../../auth/rbac.js';
import type { AktualisFelhasznalo } from '../../auth/plugin.js';
import { elemBetolt, verzioKeres, naplozEsLeptet, elemValasz } from '../kozos.js';

type Valasz = Record<string, unknown>;

/** Beküldéshez kötelező kartoték-mezők ellenőrzése. */
function bekuldesreKesz(verzio: { cim?: string; leirasMd?: string }): string[] {
  const hianyzo: string[] = [];
  if (!verzio.cim?.trim()) hianyzo.push('cím');
  if (!verzio.leirasMd?.trim()) hianyzo.push('leírás');
  return hianyzo;
}

/** Vázlat-verzió szerkesztése (tartalmi zár: csak Vázlat módosítható). */
export async function verzioSzerkesztes(
  id: string,
  verzioSzam: number,
  be: VerzioSzerkesztes,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, verzioSzam);
  ellenoriz('vázlat.szerkesztés', felh, { alkalmazasKod: elem.alkalmazasKod });
  if (v.statusz !== 'Vázlat')
    throw hiba409('Csak Vázlat státuszú verzió szerkeszthető (a jóváhagyott tartalom zárolt).');

  if (be.cim !== undefined) v.cim = be.cim;
  if (be.leirasMd !== undefined) v.leirasMd = be.leirasMd;
  if (be.leiras !== undefined) {
    (v as { leiras?: unknown }).leiras = be.leiras;
    elem.markModified('verziok');
  }
  if (be.cimkek !== undefined) elem.cimkek = be.cimkek;
  if (be.tipusMezok !== undefined) {
    v.tipusMezok = be.tipusMezok;
    elem.markModified('verziok');
  }
  v.modositottaId = felh.id as never;
  // A szerkesztő rögzítése a négy-szem-elvhez (minden tartalom-szerkesztő számít).
  const szerk = (v as { szerkesztok?: unknown[] }).szerkesztok ?? ((v as { szerkesztok: unknown[] }).szerkesztok = []);
  if (!szerk.some((s) => String(s) === felh.id)) szerk.push(felh.id);
  elem.markModified('verziok');
  await elem.save();
  return elemValasz(elem.toObject());
}

async function leptetAlap(
  id: string,
  verzioSzam: number,
  felh: AktualisFelhasznalo,
  muvelet: Parameters<typeof ellenoriz>[0],
  extraCtx: (elem: Awaited<ReturnType<typeof elemBetolt>>) => Record<string, unknown> = () => ({}),
) {
  const elem = await elemBetolt(id);
  const v = verzioKeres(elem, verzioSzam);
  ellenoriz(muvelet, felh, {
    alkalmazasKod: elem.alkalmazasKod,
    verzio: verzioCtx(v),
    ...extraCtx(elem),
  });
  return { elem, v };
}

export async function bekuldes(id: string, vsz: number, felh: AktualisFelhasznalo): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.beküldés');
  const hianyzo = bekuldesreKesz(v);
  if (hianyzo.length)
    throw hiba400(`Beküldéshez hiányzó kötelező mező(k): ${hianyzo.join(', ')}.`);
  naplozEsLeptet(v, 'Véleményezés', felh.id);
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function visszavonas(
  id: string,
  vsz: number,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.visszavonás');
  naplozEsLeptet(v, 'Vázlat', felh.id, 'beküldés visszavonva');
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function jovahagyas(
  id: string,
  vsz: number,
  be: Jovahagyas,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.jóváhagyás');
  if (be.hatalyVeg && be.hatalyVeg <= be.hatalyKezdet)
    throw hiba400('A hatályvégnek a kezdődátum után kell lennie.');
  v.hatalyKezdet = be.hatalyKezdet;
  v.hatalyVeg = be.hatalyVeg ?? null;
  const indok =
    be.indoklas ??
    `hatály: ${be.hatalyKezdet.toISOString().slice(0, 10)} – ${
      be.hatalyVeg ? be.hatalyVeg.toISOString().slice(0, 10) : 'visszavonásig'
    }`;
  naplozEsLeptet(v, 'Jóváhagyott', felh.id, indok);
  v.jovahagyasiLepesek.push({
    lepes: 1,
    szerep: 'Jóváhagyó',
    kiId: felh.id as never,
    mikor: new Date(),
    eredmeny: 'jóváhagyva',
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function visszadobas(
  id: string,
  vsz: number,
  indoklas: string,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.visszadobás');
  naplozEsLeptet(v, 'Vázlat', felh.id, indoklas);
  v.jovahagyasiLepesek.push({
    lepes: 1,
    szerep: 'Jóváhagyó',
    kiId: felh.id as never,
    mikor: new Date(),
    eredmeny: 'visszadobva',
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function elvetes(
  id: string,
  vsz: number,
  felh: AktualisFelhasznalo,
  indoklas?: string,
): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.elvetés');
  naplozEsLeptet(v, 'Elvetve', felh.id, indoklas);
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function kivezetes(
  id: string,
  vsz: number,
  hatalyVeg: Date,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.kivezetés');
  if (v.hatalyKezdet && hatalyVeg <= v.hatalyKezdet)
    throw hiba400('A hatályvégnek a kezdődátum után kell lennie.');
  v.hatalyVeg = hatalyVeg;
  naplozEsLeptet(v, 'Elavult', felh.id, 'kézi kivezetés');
  await elem.save();
  return elemValasz(elem.toObject());
}

export async function archivalas(
  id: string,
  vsz: number,
  felh: AktualisFelhasznalo,
): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.archiválás');
  naplozEsLeptet(v, 'Archivált', felh.id);
  await elem.save();
  return elemValasz(elem.toObject());
}

/** Új verzió (v+1) nyitása Vázlatként; a forrásverzió státusza változatlan. */
export async function ujVerzio(id: string, vsz: number, felh: AktualisFelhasznalo): Promise<Valasz> {
  const { elem, v } = await leptetAlap(id, vsz, felh, 'verzió.újverzió', (e) => ({
    vanUjabbAktivVerzio: vanUjabbAktivVerzio(e.verziok, vsz),
  }));
  const ujSzam = Math.max(...elem.verziok.map((x) => x.verzioSzam)) + 1;
  const most = new Date();
  elem.verziok.push({
    verzioSzam: ujSzam,
    statusz: 'Vázlat',
    cim: v.cim,
    leirasMd: v.leirasMd,
    leiras: (v as { leiras?: unknown }).leiras ?? null,
    tipusMezok: structuredClone(v.tipusMezok ?? {}),
    hatalyKezdet: null,
    hatalyVeg: null,
    letrehozva: most,
    modositottaId: felh.id as never,
    statusznaplo: [
      { hova: 'Vázlat', mikor: most, ki: felh.id, indoklas: `új verzió nyitása (v${vsz} alapján)` },
    ],
  } as never);
  await elem.save();
  return elemValasz(elem.toObject());
}
