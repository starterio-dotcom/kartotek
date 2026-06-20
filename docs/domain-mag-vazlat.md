# Domain mag — TypeScript vázlat (állapotgép, jogosultság, kapcsolat)

Ez a `packages/shared` három kritikus moduljának konkrét vázlata:

- **`packages/shared/src/allapotgep/`** — az állapotátmenet-tábla és az ütemező döntési logikája.
- **`packages/shared/src/jogosultsag/`** — a `szabad(művelet, kontextus)` függvény.
- **`packages/shared/src/kapcsolat/`** — a tipizált kapcsolatok validációja (cél-megszorítás, ciklusellenőrzés, duplikátum-tiltás).

Mindkettő **tiszta függvény** (nincs I/O, nincs DB), így önmagában tesztelhető, és **ugyanaz a kód fut a frontenden** (gomb-állapotok, optimista UX) **és a backenden** (érdemi kényszerítés). A perzisztencia és a naplóírás a backend service-é; itt csak a döntési logika van. Háttér: `docs/allapotgep.md`, `docs/velemenyezes-jovahagyas.md`, `docs/szerepkorok-jogosultsagok.md`.

## Típusok

A literál-uniók a `shared` `as const` tömbjeiből származnak (lásd `docs/mongoose-sema.md`), így a Zod, a Mongoose és ez a modul **ugyanazt** az igazságot használja.

```ts
// packages/shared/src/tipusok.ts
export const STATUSZOK = [
  'Vázlat', 'Véleményezés', 'Jóváhagyott', 'Hatályos', 'Elavult', 'Archivált', 'Elvetve',
] as const;
export const SZEREPKOROK = ['Olvasó', 'Szerző', 'Jóváhagyó', 'Admin'] as const;
export const TIPUS_KODOK = ['BUS', 'TUS', 'TUC', 'F', 'BD', 'TD'] as const;
export const KAPCSOLAT_FAJTAK = ['lebontja', 'függ tőle', 'hivatkozik', 'megfelel', 'leváltja'] as const;

export type Statusz        = typeof STATUSZOK[number];
export type Szerepkor      = typeof SZEREPKOROK[number];
export type TipusKod       = typeof TIPUS_KODOK[number];
export type KapcsolatFajta = typeof KAPCSOLAT_FAJTAK[number];
```

## 1) Állapotátmenet-tábla

```ts
// packages/shared/src/allapotgep/atmenetek.ts
import type { Statusz, Szerepkor } from '../tipusok';

/** Verzió-művelet, ami státuszátmenetet vagy új verziót eredményez. */
export type AtmenetMuvelet =
  | 'beküldés'
  | 'visszavonás'
  | 'jóváhagyás'
  | 'visszadobás'
  | 'elvetés'
  | 'újverzió'
  | 'kivezetés'
  | 'archiválás'
  | 'hatálybalépés'   // AUTO (ütemező)
  | 'elavulás';       // AUTO (ütemező)

export interface Atmenet {
  muvelet: AtmenetMuvelet;
  honnan: Statusz;
  /** A cél státusz. `null`, ha a művelet NEM ezt a verziót lépteti (lásd `ujVerzio`). */
  hova: Statusz | null;
  /** Ki válthatja ki: szerepkör vagy az ütemező (RENDSZER). */
  mod: Szerepkor | 'RENDSZER';
  /** Igaz, ha ÚJ verziót nyit Vázlatban; a forrásverzió státusza NEM változik. */
  ujVerzio?: boolean;
  /** Kötelező indoklás (pl. visszadobás). */
  indoklasKell?: boolean;
  /** Hatályossági dátum megadása kötelező (jóváhagyás). */
  hatalyKell?: boolean;
  /** Négy-szem-elv vonatkozik rá (jóváhagyás). */
  negySzem?: boolean;
  /** Megerősítést igénylő, „veszélyes” művelet. */
  veszelyes?: boolean;
}

/** A teljes állapotgép — egyetlen igazság a verzió-életciklushoz. */
export const ATMENETEK = [
  { muvelet: 'beküldés',      honnan: 'Vázlat',       hova: 'Véleményezés', mod: 'Szerző' },
  { muvelet: 'visszavonás',   honnan: 'Véleményezés', hova: 'Vázlat',       mod: 'Szerző' },
  { muvelet: 'visszadobás',   honnan: 'Véleményezés', hova: 'Vázlat',       mod: 'Jóváhagyó', indoklasKell: true, veszelyes: true },
  { muvelet: 'jóváhagyás',    honnan: 'Véleményezés', hova: 'Jóváhagyott',  mod: 'Jóváhagyó', hatalyKell: true, negySzem: true },
  { muvelet: 'elvetés',       honnan: 'Vázlat',       hova: 'Elvetve',      mod: 'Szerző', veszelyes: true },
  { muvelet: 'újverzió',      honnan: 'Jóváhagyott',  hova: null,           mod: 'Szerző', ujVerzio: true },
  { muvelet: 'újverzió',      honnan: 'Hatályos',     hova: null,           mod: 'Szerző', ujVerzio: true },
  { muvelet: 'kivezetés',     honnan: 'Hatályos',     hova: 'Elavult',      mod: 'Admin', veszelyes: true },
  { muvelet: 'archiválás',    honnan: 'Elavult',      hova: 'Archivált',    mod: 'Admin' },
  // Automata átmenetek (az ütemező lépteti, dátum alapján):
  { muvelet: 'hatálybalépés', honnan: 'Jóváhagyott',  hova: 'Hatályos',     mod: 'RENDSZER' },
  { muvelet: 'elavulás',      honnan: 'Hatályos',     hova: 'Elavult',      mod: 'RENDSZER' },
] as const satisfies readonly Atmenet[];

export const VEGALLAPOTOK: readonly Statusz[] = ['Archivált', 'Elvetve'];
export const AUTO_ATMENETEK = ATMENETEK.filter((a) => a.mod === 'RENDSZER');

/** Az adott státuszhoz és művelethez tartozó átmenet (vagy `undefined`). */
export function atmenet(honnan: Statusz, muvelet: AtmenetMuvelet): Atmenet | undefined {
  return ATMENETEK.find((a) => a.honnan === honnan && a.muvelet === muvelet);
}

/** Egy státuszból kézzel (nem AUTO) elérhető átmenetek. */
export function keziAtmenetek(honnan: Statusz): Atmenet[] {
  return ATMENETEK.filter((a) => a.honnan === honnan && a.mod !== 'RENDSZER');
}

export function vegallapot(statusz: Statusz): boolean {
  return VEGALLAPOTOK.includes(statusz);
}
```

### Ütemező — döntési logika (tiszta)

```ts
// packages/shared/src/allapotgep/utemezo.ts
import type { Statusz } from '../tipusok';

export interface VerzioAuto {
  statusz: Statusz;
  hatalyKezdet: Date | null;
  hatalyVeg: Date | null;
}

export type AutoDontes =
  | { muvelet: 'hatálybalépés'; ujStatusz: 'Hatályos' }
  | { muvelet: 'elavulás';      ujStatusz: 'Elavult' };

/** Milyen automata átmenet esedékes egy verzióra a megadott napon (vagy egyik sem). */
export function esedekesAutoAtmenet(v: VerzioAuto, ma: Date): AutoDontes | null {
  if (v.statusz === 'Jóváhagyott' && v.hatalyKezdet && v.hatalyKezdet <= ma)
    return { muvelet: 'hatálybalépés', ujStatusz: 'Hatályos' };
  if (v.statusz === 'Hatályos' && v.hatalyVeg && v.hatalyVeg < ma)
    return { muvelet: 'elavulás', ujStatusz: 'Elavult' };
  return null;
}
```

> A backend ütemező service ezt hívja minden verzióra; a hatálybalépéskor a **korábbi Hatályos verzió** `hatalyVeg`-jét az új kezdetére állítja és Elavultba lépteti (`RENDSZER` napló). Ez a több-verziós koordináció a service-é, mert írást és tranzakciót igényel.

## 2) Jogosultság — `szabad(művelet, kontextus)`

```ts
// packages/shared/src/jogosultsag/szabad.ts
import type { Statusz, Szerepkor } from '../tipusok';
import { atmenet, type AtmenetMuvelet } from '../allapotgep/atmenetek';

/** Minden jogosultság-ellenőrzött művelet. */
export type Muvelet =
  | 'elem.olvasás'
  | 'elem.létrehozás'
  | 'vázlat.szerkesztés'
  | 'verzió.beküldés'
  | 'verzió.visszavonás'
  | 'verzió.jóváhagyás'
  | 'verzió.visszadobás'
  | 'verzió.elvetés'
  | 'verzió.újverzió'
  | 'verzió.kivezetés'
  | 'verzió.archiválás'
  | 'vázlat.törlés'
  | 'megjegyzés.írás'
  | 'megjegyzés.megoldás'
  | 'kapcsolat.kezelés'
  | 'címke.kezelés'
  | 'melléklet.kezelés'
  | 'szolgáltatás.kezelés'   // szolgáltatás/alkalmazás CRUD — csak globális Admin
  | 'alkalmazás.metaadat'    // saját alkalmazás metaadata — alkalmazás-Admin
  | 'tagság.kezelés';        // szerepkör-kiosztás az alkalmazáson

export interface FelhasznaloCtx {
  id: string;
  globalisAdmin: boolean;
  tagsagok: { alkalmazasKod: string; szerepkor: Szerepkor }[];
}

export interface VerzioCtx {
  statusz: Statusz;
  /** A verzió szerzői/szerkesztői — a négy-szem-elvhez. */
  szerkesztoIds: string[];
}

export interface Kontextus {
  felhasznalo: FelhasznaloCtx;
  /** Az alkalmazás hatóköre (elem-szintű műveleteknél kötelező). */
  alkalmazasKod?: string;
  /** Az érintett verzió (életciklus-műveleteknél). */
  verzio?: VerzioCtx;
  /** Új verzió nyitásához: van-e már újabb aktív verzió az elemen. */
  vanUjabbAktivVerzio?: boolean;
}

/** Alap-mátrix: mely szerepkörök engedélyezik a műveletet (lásd docs/szerepkorok-jogosultsagok.md). */
const MUVELET_SZEREPEK: Record<Muvelet, readonly Szerepkor[]> = {
  'elem.olvasás':         ['Olvasó', 'Szerző', 'Jóváhagyó', 'Admin'],
  'elem.létrehozás':      ['Szerző', 'Admin'],
  'vázlat.szerkesztés':   ['Szerző', 'Admin'],
  'verzió.beküldés':      ['Szerző', 'Admin'],
  'verzió.visszavonás':   ['Szerző', 'Admin'],
  'verzió.jóváhagyás':    ['Jóváhagyó', 'Admin'],
  'verzió.visszadobás':   ['Jóváhagyó', 'Admin'],
  'verzió.elvetés':       ['Szerző', 'Admin'],
  'verzió.újverzió':      ['Szerző', 'Admin'],
  'verzió.kivezetés':     ['Admin'],
  'verzió.archiválás':    ['Admin'],
  'vázlat.törlés':        ['Admin'],
  'megjegyzés.írás':      ['Szerző', 'Jóváhagyó', 'Admin'],
  'megjegyzés.megoldás':  ['Szerző', 'Jóváhagyó', 'Admin'],
  'kapcsolat.kezelés':    ['Szerző', 'Admin'],
  'címke.kezelés':        ['Szerző', 'Admin'],
  'melléklet.kezelés':    ['Szerző', 'Admin'],
  'szolgáltatás.kezelés': [],          // csak globalisAdmin (lent rövidre zárva)
  'alkalmazás.metaadat':  ['Admin'],
  'tagság.kezelés':       ['Admin'],   // saját alkalmazásra; rendszerszintű a globalisAdmin
};

/** Életciklus-művelet → állapotgép-művelet (a státusz-előfeltételhez). */
const ELETCIKLUS: Partial<Record<Muvelet, AtmenetMuvelet>> = {
  'verzió.beküldés':    'beküldés',
  'verzió.visszavonás': 'visszavonás',
  'verzió.jóváhagyás':  'jóváhagyás',
  'verzió.visszadobás': 'visszadobás',
  'verzió.elvetés':     'elvetés',
  'verzió.újverzió':    'újverzió',
  'verzió.kivezetés':   'kivezetés',
  'verzió.archiválás':  'archiválás',
};

/** A felhasználó szerepkörei az adott alkalmazáson (globalisAdmin nélkül). */
function szerepek(f: FelhasznaloCtx, alkalmazasKod?: string): Szerepkor[] {
  if (!alkalmazasKod) return [];
  return f.tagsagok.filter((t) => t.alkalmazasKod === alkalmazasKod).map((t) => t.szerepkor);
}

/**
 * Eldönti, hogy a felhasználó az adott kontextusban végrehajthatja-e a műveletet.
 * EGYETLEN igazság: ezt hívja a frontend (gomb-állapot) és a backend (kényszerítés) is.
 */
export function szabad(muvelet: Muvelet, ctx: Kontextus): boolean {
  const f = ctx.felhasznalo;

  // 1) Rendszerszintű művelet: kizárólag globális Admin.
  if (muvelet === 'szolgáltatás.kezelés') return f.globalisAdmin;

  // 2) Szerepkör-ellenőrzés (alap-mátrix) az alkalmazás hatókörében; a globális Admin átmegy.
  const engedelyezett = MUVELET_SZEREPEK[muvelet];
  const szerepRendben =
    f.globalisAdmin || szerepek(f, ctx.alkalmazasKod).some((sz) => engedelyezett.includes(sz));
  if (!szerepRendben) return false;

  // 3) Életciklus-műveleteknél: státusz-előfeltétel + speciális szabályok.
  const eletciklus = ELETCIKLUS[muvelet];
  if (eletciklus) {
    if (!ctx.verzio) return false;
    const at = atmenet(ctx.verzio.statusz, eletciklus);
    if (!at) return false; // ebből a státuszból nincs ilyen átmenet

    // 3a) Új verzió: csak ha nincs még újabb aktív verzió az elemen.
    if (eletciklus === 'újverzió' && ctx.vanUjabbAktivVerzio) return false;

    // 3b) Négy-szem-elv (jóváhagyás): a szerző/szerkesztő nem hagyhatja jóvá — a globális Adminra is áll.
    if (at.negySzem && ctx.verzio.szerkesztoIds.includes(f.id)) return false;
  }

  return true;
}

/** A felületen az adott verzión elérhető életciklus-műveletek a kontextusban. */
export function elerhetoVerzioMuveletek(ctx: Kontextus): Muvelet[] {
  if (!ctx.verzio) return [];
  return (Object.keys(ELETCIKLUS) as Muvelet[]).filter((m) => szabad(m, ctx));
}
```

## 3) Kapcsolat-validáció

```ts
// packages/shared/src/kapcsolat/szabalyok.ts
import type { TipusKod, KapcsolatFajta } from '../tipusok';

/** A célpont fajtája. */
export type CelFajta = 'elem' | 'szabályzat' | 'külső';

export interface UjKapcsolat {
  forrasElemId: string;
  celElemId?: string | null;
  celSzabalyzatKod?: string | null;
  celKulsoLink?: string | null;
  fajta: KapcsolatFajta;
}

/** A validációhoz szükséges kontextus (a hívó tölti ki a DB-ből). */
export interface KapcsolatCtx {
  /** A forráselem típusa. */
  forrasTipus: TipusKod;
  /** A célelem típusa, ha a cél belső elem (celElemId). */
  celTipus?: TipusKod;
  /** Az AZONOS forrásból kiinduló meglévő kapcsolatok (duplikátum-ellenőrzéshez). */
  meglevoKapcsolatok: Pick<UjKapcsolat, 'celElemId' | 'celSzabalyzatKod' | 'celKulsoLink' | 'fajta'>[];
  /** A `lebontja` élek (forras→cel) a ciklusellenőrzéshez. */
  lebontjaElek: { forras: string; cel: string }[];
}

/** Megengedett célfajták kapcsolattípusonként (lásd docs/kapcsolatok.md). */
const CEL_SZABALY: Record<KapcsolatFajta, readonly CelFajta[]> = {
  'lebontja':   ['elem'],
  'függ tőle':  ['elem'],
  'hivatkozik': ['elem', 'külső'],   // belső elem (BD/TD) vagy külső link
  'megfelel':   ['szabályzat'],
  'leváltja':   ['elem'],
};

export interface ValidacioEredmeny {
  ervenyes: boolean;
  hibak: string[];
  /** `leváltja` esetén igaz: a hívó ajánlja fel a cél Elavultba léptetését. */
  felajanlElavultat?: boolean;
}

/** A megadott új kapcsolat melyik célfajtába esik (és kitöltött-e pontosan egy cél-mező). */
export function celFajta(k: UjKapcsolat): CelFajta | 'hiányzó' | 'több' {
  const megadott = [k.celElemId, k.celSzabalyzatKod, k.celKulsoLink].filter((x) => x != null);
  if (megadott.length === 0) return 'hiányzó';
  if (megadott.length > 1) return 'több';
  if (k.celElemId != null) return 'elem';
  if (k.celSzabalyzatKod != null) return 'szabályzat';
  return 'külső';
}

/** Elérhető-e `cel` a `start`-ból a `lebontja` élek mentén (irányítottan)? */
export function elerheto(start: string, cel: string, elek: { forras: string; cel: string }[]): boolean {
  const sor = [start];
  const latott = new Set<string>();
  while (sor.length) {
    const akt = sor.shift()!;
    if (akt === cel) return true;
    if (latott.has(akt)) continue;
    latott.add(akt);
    for (const e of elek) if (e.forras === akt) sor.push(e.cel);
  }
  return false;
}

const celSzo = (cf: CelFajta) =>
  cf === 'elem' ? 'belső elem' : cf === 'szabályzat' ? 'szabályzat' : 'külső link';

const azonosCel = (
  a: Pick<UjKapcsolat, 'celElemId' | 'celSzabalyzatKod' | 'celKulsoLink'>,
  b: UjKapcsolat,
) =>
  (a.celElemId ?? null) === (b.celElemId ?? null) &&
  (a.celSzabalyzatKod ?? null) === (b.celSzabalyzatKod ?? null) &&
  (a.celKulsoLink ?? null) === (b.celKulsoLink ?? null);

/** A tipizált kapcsolat felvételének validációja (tiszta függvény). */
export function kapcsolatValidacio(k: UjKapcsolat, ctx: KapcsolatCtx): ValidacioEredmeny {
  const hibak: string[] = [];
  const cf = celFajta(k);

  // 1) Pontosan egy cél-mező legyen kitöltve.
  if (cf === 'hiányzó') hibak.push('Nincs megadva cél.');
  else if (cf === 'több') hibak.push('Egyszerre csak egy cél adható meg (elem, szabályzat vagy külső link).');

  // 2) Önhivatkozás tiltása (belső elem-célnál).
  if (k.celElemId && k.celElemId === k.forrasElemId)
    hibak.push('Egy elem nem kapcsolódhat önmagához.');

  // 3) Cél-megszorítás a fajta szerint.
  if (cf === 'elem' || cf === 'szabályzat' || cf === 'külső') {
    if (!CEL_SZABALY[k.fajta].includes(cf))
      hibak.push(`A(z) „${k.fajta}” célja nem lehet ${celSzo(cf)}.`);
  }

  // 3a) `hivatkozik` belső elem-célja csak BD vagy TD lehet.
  if (k.fajta === 'hivatkozik' && cf === 'elem' && ctx.celTipus && !['BD', 'TD'].includes(ctx.celTipus))
    hibak.push('A „hivatkozik” belső célja csak BD vagy TD lehet (egyébként használj külső linket).');

  // 3b) `leváltja` csak azonos típusú elemek között.
  if (k.fajta === 'leváltja' && cf === 'elem' && ctx.celTipus && ctx.celTipus !== ctx.forrasTipus)
    hibak.push('A „leváltja” csak azonos típusú elemek között megengedett.');

  // 4) Duplikátum-tiltás (azonos forrás–cél–fajta).
  if (ctx.meglevoKapcsolatok.some((m) => m.fajta === k.fajta && azonosCel(m, k)))
    hibak.push('Ez a kapcsolat már létezik.');

  // 5) Ciklusmentesség a `lebontja`-nál: az új él kört okoz, ha a cél már eléri a forrást.
  if (k.fajta === 'lebontja' && k.celElemId && elerheto(k.celElemId, k.forrasElemId, ctx.lebontjaElek))
    hibak.push('A „lebontja” kör keletkezne — a cél már (közvetve) tartalmazza a forrást.');

  return {
    ervenyes: hibak.length === 0,
    hibak,
    felajanlElavultat: hibak.length === 0 && k.fajta === 'leváltja',
  };
}
```

> **Hatókör a szolgáltatásban:** a `ctx` mezőit a service tölti ki a DB-ből — a forrás/cél típusát, az azonos forrásból induló meglévő kapcsolatokat és a `lebontja` éleket. Nagy gráfnál a ciklusellenőrzés a `lebontja` élek betöltése helyett a MongoDB **`$graphLookup`**-jával is megoldható (a cél elemből kiindulva keressük, eléri-e a forrást). A `leváltja`-nál a `felajanlElavultat` jelzésre a felület külön, megerősített akciót ajánl, amit az állapotgép + `szabad('verzió.kivezetés', …)` szerint a megfelelő jogú felhasználó hajthat végre.

## Használati példák

```ts
// Frontend — gomb tiltása/engedélyezése (optimista UX):
const beküldhet = szabad('verzió.beküldés', { felhasznalo, alkalmazasKod, verzio });

// Frontend — a léptető gombok listája egy verzióhoz:
const gombok = elerhetoVerzioMuveletek({ felhasznalo, alkalmazasKod, verzio, vanUjabbAktivVerzio });

// Backend — érdemi kényszerítés (a route handler elején):
if (!szabad('verzió.jóváhagyás', ctx)) {
  return reply.code(403).send({ hiba: 'Nincs jogosultság' });
}
// (siker esetén a service végrehajtja az átmenetet és ír a Státusznaplóba)
```

## Mit fedjenek a Vitest-tesztek (Fázis 1)

- **Állapotgép:** minden érvényes átmenet megtalálható; minden **érvénytelen** (honnan, művelet) pár `undefined`; a végállapotokból nincs kézi átmenet; az AUTO halmaz pontosan a két automata átmenet.
- **Ütemező:** `esedekesAutoAtmenet` a határnapokon helyesen dönt (kezdődátum = ma → hatálybalépés; végdátum < ma → elavulás; üres dátum → nincs).
- **Jogosultság:** a mátrix minden cellája (szerepkör × művelet); a **négy-szem-elv** (a szerző saját elemét nem hagyhatja jóvá, akkor sem, ha Admin/globális Admin); a tagság nélküli felhasználó semmihez; a `szolgáltatás.kezelés` csak globalisAdminnak; az „új verzió csak ha nincs újabb aktív” szabály.
- **Kapcsolat:** a cél-megszorítás minden fajtára; a `hivatkozik` csak BD/TD belső célt enged (egyébként külső link); a `leváltja` csak azonos típus; az önhivatkozás és a duplikátum tiltása; a `lebontja` ciklusfelismerés (közvetlen és közvetett kör is); pontosan egy cél-mező kitöltöttsége.
