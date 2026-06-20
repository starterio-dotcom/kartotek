import type { TipusKod, KapcsolatFajta } from '../tipusok.js';

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
  meglevoKapcsolatok: Pick<
    UjKapcsolat,
    'celElemId' | 'celSzabalyzatKod' | 'celKulsoLink' | 'fajta'
  >[];
  /** A `lebontja` élek (forras→cel) a ciklusellenőrzéshez. */
  lebontjaElek: { forras: string; cel: string }[];
}

/** Megengedett célfajták kapcsolattípusonként (lásd docs/kapcsolatok.md). */
const CEL_SZABALY: Record<KapcsolatFajta, readonly CelFajta[]> = {
  lebontja: ['elem'],
  'függ tőle': ['elem'],
  hivatkozik: ['elem', 'külső'], // belső elem (BD/TD) vagy külső link
  megfelel: ['szabályzat'],
  leváltja: ['elem'],
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
export function elerheto(
  start: string,
  cel: string,
  elek: { forras: string; cel: string }[],
): boolean {
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
  else if (cf === 'több')
    hibak.push('Egyszerre csak egy cél adható meg (elem, szabályzat vagy külső link).');

  // 2) Önhivatkozás tiltása (belső elem-célnál).
  if (k.celElemId && k.celElemId === k.forrasElemId)
    hibak.push('Egy elem nem kapcsolódhat önmagához.');

  // 3) Cél-megszorítás a fajta szerint.
  if (cf === 'elem' || cf === 'szabályzat' || cf === 'külső') {
    if (!CEL_SZABALY[k.fajta].includes(cf))
      hibak.push(`A(z) „${k.fajta}” célja nem lehet ${celSzo(cf)}.`);
  }

  // 3a) `hivatkozik` belső elem-célja csak BD vagy TD lehet.
  // Fail-closed: ismeretlen céltípusnál (belső elem-cél) inkább tiltunk.
  if (
    k.fajta === 'hivatkozik' &&
    cf === 'elem' &&
    (!ctx.celTipus || !['BD', 'TD'].includes(ctx.celTipus))
  )
    hibak.push(
      'A „hivatkozik” belső célja csak BD vagy TD lehet (egyébként használj külső linket).',
    );

  // 3b) `leváltja` csak azonos típusú elemek között. Fail-closed ismeretlen céltípusnál.
  if (k.fajta === 'leváltja' && cf === 'elem' && (!ctx.celTipus || ctx.celTipus !== ctx.forrasTipus))
    hibak.push('A „leváltja” csak azonos típusú elemek között megengedett.');

  // 4) Duplikátum-tiltás (azonos forrás–cél–fajta).
  if (ctx.meglevoKapcsolatok.some((m) => m.fajta === k.fajta && azonosCel(m, k)))
    hibak.push('Ez a kapcsolat már létezik.');

  // 5) Ciklusmentesség a `lebontja`-nál: az új él kört okoz, ha a cél már eléri a forrást.
  if (
    k.fajta === 'lebontja' &&
    k.celElemId &&
    elerheto(k.celElemId, k.forrasElemId, ctx.lebontjaElek)
  )
    hibak.push('A „lebontja” kör keletkezne — a cél már (közvetve) tartalmazza a forrást.');

  return {
    ervenyes: hibak.length === 0,
    hibak,
    felajanlElavultat: hibak.length === 0 && k.fajta === 'leváltja',
  };
}
