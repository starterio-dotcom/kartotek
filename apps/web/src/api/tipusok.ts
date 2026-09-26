import type { Statusz, Szerepkor, TipusKod, RetegKod, KapcsolatFajta } from '@kartotek/shared';

export interface Naplo {
  honnan?: Statusz;
  hova: Statusz;
  mikor: string;
  ki: string;
  indoklas?: string;
}

export interface Melleklet {
  mid: string;
  tipus: 'kep' | 'figma' | 'csv';
  alt: string;
  tartalomHiv: string;
  mime?: string;
  figmaPng?: string;
  figmaLink?: string;
  /** Az API-tól: a tartalom-végpont ki tudja-e szolgálni a fájlt. */
  vanTartalom?: boolean;
  /** Az API-tól: rövid életre aláírt tartalom-URL (a natív média ezzel tölt). */
  tartalomUrl?: string;
}

export interface Megjegyzes {
  mjid: string;
  szerzoId: string;
  szoveg: string;
  horgony?: string;
  valaszMjid?: string;
  allapot: 'nyitott' | 'megoldott';
  letrehozva: string;
}

export interface Verzio {
  verzioSzam: number;
  statusz: Statusz;
  cim: string;
  leirasMd: string;
  /** Gazdag tartalom (TipTap JSON). Ha hiányzik, a leirasMd a forrás. */
  leiras?: unknown;
  tipusMezok: Record<string, unknown>;
  hatalyKezdet: string | null;
  hatalyVeg: string | null;
  fagyasztva?: string | null;
  letrehozva: string;
  modositottaId: string;
  /** Tartalmi revízió (optimista zár): a mentés ezt küldi vissza `alapRevizio`-ként. */
  revizio?: number;
  kiadasIds?: string[];
  statusznaplo: Naplo[];
  mellekletek: Melleklet[];
  megjegyzesek: Megjegyzes[];
}

export interface Elem {
  id: string;
  kulcs: string;
  tipusKod: TipusKod;
  alkalmazasKod: string;
  retegKod: RetegKod | null;
  cimkek: string[];
  verziok: Verzio[];
}

export interface Kapcsolat {
  id: string;
  forrasElemId: string;
  celElemId: string | null;
  celSzabalyzatKod: string | null;
  celKulsoLink: string | null;
  fajta: KapcsolatFajta;
}

export interface ElemKapcsolatok {
  kimeno: Kapcsolat[];
  bejovo: Kapcsolat[];
}

export interface Felhasznalo {
  id: string;
  nev: string;
  email: string;
  globalisAdmin: boolean;
  tagsagok: { alkalmazasKod: string; szerepkor: Szerepkor }[];
}

export interface Szolgaltatas {
  id: string;
  kod: string;
  nev: string;
  leiras?: string;
}

export interface Alkalmazas {
  id: string;
  kod: string;
  nev: string;
  leiras?: string;
  szolgaltatasKod: string;
}

/* ---------- Fázis 6: törlés, riportok, kiadások ---------- */

export interface TorlesDontes {
  torolheto: boolean;
  okok: string[];
  ajanlott: 'elvetés' | 'archiválás' | null;
  kulcs: string;
}

export interface ElemFej {
  id: string;
  kulcs: string;
  cim: string;
  tipusKod: TipusKod;
  retegKod: RetegKod | null;
  alkalmazasKod: string;
}

export interface LefedettsegRiport {
  osszesBus: number;
  fedetlenek: ElemFej[];
}

export interface MegfelelesTetel {
  kod: string;
  nev: string;
  url: string;
  megfelelok: ElemFej[];
}

export interface HatasElem extends ElemFej {
  melyseg: number;
  statusz: Statusz;
}

export interface HatasRiport {
  elem: ElemFej;
  lefele: HatasElem[];
  felfele: HatasElem[];
}

export interface Kiadas {
  id: string;
  verzio: string;
  datum: string;
}

export interface KiadasVerzio {
  elemId: string;
  kulcs: string;
  cim: string;
  alkalmazasKod: string;
  verzioSzam: number;
  statusz: Statusz;
}

export interface KiadasTartalom {
  kiadas: Kiadas;
  verziok: KiadasVerzio[];
}

/** Az elemlista összegző nézetének verziója (tartalom, napló, mellékletek nélkül). */
export type VerzioOsszegzo = Pick<Verzio, 'verzioSzam' | 'statusz' | 'cim' | 'hatalyKezdet' | 'hatalyVeg' | 'letrehozva'>;

/** Az elemlista összegző eleme — a listázáshoz, szűréshez, számlálókhoz elég. */
export type ElemOsszegzo = Pick<Elem, 'id' | 'kulcs' | 'tipusKod' | 'alkalmazasKod' | 'retegKod' | 'cimkek'> & {
  verziok: VerzioOsszegzo[];
};

export interface AuditBejegyzes {
  id: string;
  idopont: string;
  esemeny: 'modositas' | 'hozzaferes-megtagadva' | 'olvasas';
  felhasznaloId: string | null;
  email: string | null;
  nev: string | null;
  ip: string;
  metodus: string;
  utvonal: string;
  ut: string;
  parameterek: Record<string, string>;
  elemId: string | null;
  /** Az érintett elem beszédes kulcsa (a szerver oldja fel). */
  elemKulcs: string | null;
  statusz: number;
  idotartamMs: number | null;
}

export interface AuditLista {
  bejegyzesek: AuditBejegyzes[];
  osszes: number;
  limit: number;
  offset: number;
}
