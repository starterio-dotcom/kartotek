/**
 * A v4 prototípus (`prototipus/kartotek-prototipus-v4.html`) példaadatainak hű
 * átirata (lásd docs/migracio.md). A nagy bináris tartalmak (Figma-PNG, SVG, CSV)
 * helyett tárhely-hivatkozás (`seed://…`) szerepel — a tényleges fájlok az
 * object storage-ba kerülnek (Fázis 4); a metaadat és a Figma élő link (a helyesen
 * URL-kódolt `node-id`-val) megmarad.
 */

export interface NyersNaplo {
  mikor: string;
  ki: string; // felhasználó NEVE vagy 'RENDSZER'
  honnan?: string; // hiányzik a létrehozásnál
  hova: string;
  megj?: string;
}

export interface NyersMelleklet {
  mid: string;
  tipus: 'kep' | 'figma' | 'csv';
  alt: string;
  tartalomHiv: string;
  figmaPng?: string;
  figmaLink?: string;
}

export interface NyersVerzio {
  v: number;
  statusz: string;
  rovid: string;
  leiras: string;
  elofeltetelek: string;
  kriteriumok: string;
  cia: { c: number; i: number; a: number } | null;
  hatalyKezdet: string | null;
  hatalyVeg: string | null;
  letrehozva: string;
  modositotta: string; // felhasználó NEVE
  mellekletek?: NyersMelleklet[];
  naplo: NyersNaplo[];
}

export interface NyersElem {
  kulcs: string;
  tipus: string;
  reteg: string | null;
  cim: string;
  tagek: string[];
  verziok: NyersVerzio[];
}

export interface NyersKapcsolat {
  forras: string;
  cel: string;
  fajta: string;
}

export const SZOLGALTATAS = {
  kod: 'FAIR',
  nev: 'FAIR üzleti szolgáltatás',
  leiras: 'Követelmény- és dokumentumnyilvántartás a FAIR szolgáltatás alá tartozó alkalmazásokhoz.',
  gazda: 'Nagy Péter',
} as const;

export const ALKALMAZASOK = [
  {
    kod: '3R',
    szolgaltatasKod: 'FAIR',
    nev: 'Rendezvényregisztrációs rendszer',
    leiras: 'Rendezvényregisztrációs rendszer az NFK megrendelésére.',
  },
  {
    kod: 'Terminus',
    szolgaltatasKod: 'FAIR',
    nev: 'Terminus',
    leiras:
      'Önálló alkalmazás: a regisztrációs adatok fogadását és tárolását végző háttérszolgáltatás.',
  },
] as const;

export const SZABALYZATOK = [
  {
    kod: 'IB-XYT-14-1213',
    nev: 'Account management in back office systems',
    url: 'https://pelda.gov.hu/szabalyzatok/IB-XYT-14-1213',
  },
] as const;

/** Felhasználók + alkalmazásra szabott szerepkörök (docs/szerepkorok-jogosultsagok.md). */
export const FELHASZNALOK = [
  {
    nev: 'Kiss Anna',
    email: 'kiss.anna@pelda.hu',
    globalisAdmin: false,
    tagsagok: [{ alkalmazasKod: '3R', szerepkor: 'Szerző' as const }],
  },
  {
    nev: 'Szabó Júlia',
    email: 'szabo.julia@pelda.hu',
    globalisAdmin: false,
    tagsagok: [{ alkalmazasKod: '3R', szerepkor: 'Szerző' as const }],
  },
  {
    nev: 'Tóth Bence',
    email: 'toth.bence@pelda.hu',
    globalisAdmin: false,
    tagsagok: [{ alkalmazasKod: '3R', szerepkor: 'Szerző' as const }],
  },
  {
    nev: 'Varga Dóra',
    email: 'varga.dora@pelda.hu',
    globalisAdmin: false,
    tagsagok: [{ alkalmazasKod: 'Terminus', szerepkor: 'Szerző' as const }],
  },
  {
    // FAIR-gazda → globális Admin (ő a jóváhagyó a naplókban; a négy-szem-elv így is áll).
    nev: 'Nagy Péter',
    email: 'nagy.peter@pelda.hu',
    globalisAdmin: true,
    tagsagok: [],
  },
] as const;

const FIGMA_M4_LINK =
  'https://www.figma.com/design/fJ63JKtYC0OvFoY3UMCLI7/Rendezv%C3%A9ny-oldal?node-id=297%3A4125';

export const ELEMEK: NyersElem[] = [
  {
    kulcs: '3R-BUS-001',
    tipus: 'BUS',
    reteg: null,
    cim: 'Papíralapú regisztráció',
    tagek: ['regisztráció', 'kivezetett'],
    verziok: [
      {
        v: 1,
        statusz: 'Elavult',
        rovid: 'A vendégek papíralapú jelentkezési lapon regisztrálnak.',
        leiras:
          'A helyszíni hostess papíralapú jelentkezési lapot ad át a vendégnek, amelyet kitöltve a regisztrációs pultnál kell leadni.',
        elofeltetelek: '',
        kriteriumok: '',
        cia: null,
        hatalyKezdet: '2025-01-10',
        hatalyVeg: '2026-02-01',
        letrehozva: '2024-12-02',
        modositotta: 'Kiss Anna',
        naplo: [
          { mikor: '2024-12-02', ki: 'Kiss Anna', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2024-12-10', ki: 'Kiss Anna', honnan: 'Vázlat', hova: 'Véleményezés' },
          {
            mikor: '2024-12-18',
            ki: 'Nagy Péter',
            honnan: 'Véleményezés',
            hova: 'Jóváhagyott',
            megj: 'hatály: 2025-01-10 –',
          },
          {
            mikor: '2025-01-10',
            ki: 'RENDSZER',
            honnan: 'Jóváhagyott',
            hova: 'Hatályos',
            megj: 'kezdődátum elérve',
          },
          {
            mikor: '2026-02-01',
            ki: 'RENDSZER',
            honnan: 'Hatályos',
            hova: 'Elavult',
            megj: 'leváltotta: 3R-BUS-002',
          },
        ],
      },
    ],
  },
  {
    kulcs: '3R-BUS-002',
    tipus: 'BUS',
    reteg: null,
    cim: 'Regisztráció az eseményre',
    tagek: ['regisztráció', 'üzleti'],
    verziok: [
      {
        v: 1,
        statusz: 'Hatályos',
        rovid: 'A Vendég regisztrációjának folyamata.',
        leiras:
          'Vendégként szeretnék visszaigazoltan regisztrálni az eseményre annak érdekében, hogy részt tudjak venni rajta.\n\nAz űrlap vázlata:\n\n![Az űrlap vázlata](melleklet:M2)',
        elofeltetelek:
          'Az esemény nyilvános regisztrációs felülete elérhető. A vendég nem érte el az esemény létszámkorlátját.',
        kriteriumok:
          'A megerősítő e-mail 2 percen belül kiküldésre kerül. A GDPR-nyilatkozat elfogadása nélkül a regisztráció nem küldhető be.',
        cia: null,
        hatalyKezdet: '2026-02-01',
        hatalyVeg: null,
        letrehozva: '2026-01-05',
        modositotta: 'Kiss Anna',
        mellekletek: [
          {
            mid: 'M1',
            tipus: 'figma',
            alt: 'Regisztrációs űrlap — desktop frame',
            tartalomHiv: 'seed://3R-BUS-002/v1/M1',
            figmaLink: 'https://www.figma.com/design/PELDA/3R-tervek?node-id=12-34',
          },
          {
            mid: 'M2',
            tipus: 'kep',
            alt: 'urlap-vazlat.svg',
            tartalomHiv: 'seed://3R-BUS-002/v1/M2.svg',
          },
        ],
        naplo: [
          { mikor: '2026-01-05', ki: 'Kiss Anna', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-01-12', ki: 'Kiss Anna', honnan: 'Vázlat', hova: 'Véleményezés' },
          {
            mikor: '2026-01-20',
            ki: 'Nagy Péter',
            honnan: 'Véleményezés',
            hova: 'Jóváhagyott',
            megj: 'hatály: 2026-02-01 – visszavonásig',
          },
          {
            mikor: '2026-02-01',
            ki: 'RENDSZER',
            honnan: 'Jóváhagyott',
            hova: 'Hatályos',
            megj: 'kezdődátum elérve',
          },
        ],
      },
      {
        v: 2,
        statusz: 'Vázlat',
        rovid: 'A Vendég regisztrációjának folyamata, QR-kódos beléptetéssel kiegészítve.',
        leiras:
          'A v1 folyamat kiegészítése: a sikeres regisztrációt visszaigazoló e-mail QR-kódot is tartalmaz.\n\n![Regisztációs űrlap](melleklet:M4)',
        elofeltetelek: 'Az esemény nyilvános regisztrációs felülete elérhető.',
        kriteriumok: 'A QR-kód egyedi és a regisztráció törlésekor érvényét veszti.',
        cia: null,
        hatalyKezdet: null,
        hatalyVeg: null,
        letrehozva: '2026-06-01',
        modositotta: 'Kiss Anna',
        mellekletek: [
          {
            mid: 'M4',
            tipus: 'figma',
            alt: 'Regisztációs űrlap (3R Figma terv)',
            tartalomHiv: 'seed://3R-BUS-002/v2/M4.png',
            figmaPng: 'seed://3R-BUS-002/v2/M4.png',
            figmaLink: FIGMA_M4_LINK,
          },
        ],
        naplo: [
          {
            mikor: '2026-06-01',
            ki: 'Kiss Anna',
            hova: 'Vázlat',
            megj: 'új verzió nyitása (v1 alapján)',
          },
        ],
      },
    ],
  },
  {
    kulcs: '3R-TUC-001',
    tipus: 'TUC',
    reteg: null,
    cim: 'Megerősítő e-mail forgatókönyv',
    tagek: ['e-mail', 'forgatókönyv'],
    verziok: [
      {
        v: 1,
        statusz: 'Jóváhagyott',
        rovid: 'A regisztráció e-mailes megerősítésének fő-, alternatív és hibaága.',
        leiras:
          'Fő ág: a rendszer megerősítő e-mailt küld, a vendég megerősíti, a rendszer visszaigazol.\n\nHibaág: kézbesítési hibánál 3x újrapróbálkozás, majd hibanapló.',
        elofeltetelek: 'A vendég beküldte a regisztrációs űrlapot.',
        kriteriumok: 'Az újraküldési kísérletek között legalább 5 perc telik el.',
        cia: null,
        hatalyKezdet: '2026-06-20',
        hatalyVeg: null,
        letrehozva: '2026-04-08',
        modositotta: 'Tóth Bence',
        naplo: [
          { mikor: '2026-04-08', ki: 'Tóth Bence', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-05-04', ki: 'Tóth Bence', honnan: 'Vázlat', hova: 'Véleményezés' },
          {
            mikor: '2026-05-15',
            ki: 'Nagy Péter',
            honnan: 'Véleményezés',
            hova: 'Jóváhagyott',
            megj: 'hatály: 2026-06-20 – visszavonásig',
          },
        ],
      },
    ],
  },
  {
    kulcs: '3R-F-001',
    tipus: 'F',
    reteg: null,
    cim: 'E-mail-értesítések',
    tagek: ['e-mail', 'képesség'],
    verziok: [
      {
        v: 1,
        statusz: 'Hatályos',
        rovid: 'A rendszer tranzakciós e-mail küldési képessége.',
        leiras:
          'A rendszer sablon alapú tranzakciós e-maileket küld: megerősítés, sikeres regisztráció, duplikáció-értesítés, törlés-visszaigazolás.',
        elofeltetelek: '',
        kriteriumok: 'Minden kimenő e-mail naplózott.',
        cia: null,
        hatalyKezdet: '2026-03-01',
        hatalyVeg: null,
        letrehozva: '2026-02-02',
        modositotta: 'Szabó Júlia',
        naplo: [
          { mikor: '2026-02-02', ki: 'Szabó Júlia', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-02-10', ki: 'Szabó Júlia', honnan: 'Vázlat', hova: 'Véleményezés' },
          {
            mikor: '2026-02-20',
            ki: 'Nagy Péter',
            honnan: 'Véleményezés',
            hova: 'Jóváhagyott',
            megj: 'hatály: 2026-03-01 – visszavonásig',
          },
          {
            mikor: '2026-03-01',
            ki: 'RENDSZER',
            honnan: 'Jóváhagyott',
            hova: 'Hatályos',
            megj: 'kezdődátum elérve',
          },
        ],
      },
    ],
  },
  {
    kulcs: '3R-FE-TUS-002',
    tipus: 'TUS',
    reteg: 'FE',
    cim: 'Regisztrációs űrlap validáció és beküldés',
    tagek: ['űrlap', 'validáció'],
    verziok: [
      {
        v: 1,
        statusz: 'Vázlat',
        rovid: 'Kliensoldali mezővalidáció és a beküldés folyamata.',
        leiras:
          'Az űrlap kötelező mezői: név, e-mail cím, GDPR-nyilatkozat. A beküldés gomb csak érvényes kitöltés esetén aktív.',
        elofeltetelek: 'A 3R-BD-001 szerinti űrlapdefiníció rendelkezésre áll.',
        kriteriumok: 'A validációs hibaüzenetek akadálymentesen (aria-describedby) kapcsolódnak.',
        cia: null,
        hatalyKezdet: null,
        hatalyVeg: null,
        letrehozva: '2026-06-05',
        modositotta: 'Szabó Júlia',
        naplo: [{ mikor: '2026-06-05', ki: 'Szabó Júlia', hova: 'Vázlat', megj: 'létrehozás' }],
      },
    ],
  },
  {
    kulcs: '3R-Core-TUS-003',
    tipus: 'TUS',
    reteg: 'Core',
    cim: 'Megerősítő e-mail küldése',
    tagek: ['e-mail'],
    verziok: [
      {
        v: 1,
        statusz: 'Véleményezés',
        rovid: 'A megerősítő e-mail összeállítása és kiküldése a Core rétegben.',
        leiras:
          'A szolgáltatás a regisztrációs esemény hatására sablonból összeállítja és kiküldi a megerősítő e-mailt, az eredményt naplózza.',
        elofeltetelek: 'Az e-mail sablontár elérhető.',
        kriteriumok:
          'A felhasználó az [IB-XYT-14-1213] megfelelés érdekében nem kap vissza jelszót vagy tokent nyílt szövegként.',
        cia: null,
        hatalyKezdet: null,
        hatalyVeg: null,
        letrehozva: '2026-05-20',
        modositotta: 'Tóth Bence',
        naplo: [
          { mikor: '2026-05-20', ki: 'Tóth Bence', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-06-08', ki: 'Tóth Bence', honnan: 'Vázlat', hova: 'Véleményezés' },
        ],
      },
    ],
  },
  {
    kulcs: '3R-BD-001',
    tipus: 'BD',
    reteg: null,
    cim: 'Regisztrációs űrlap (dokumentum)',
    tagek: ['űrlap', 'GDPR'],
    verziok: [
      {
        v: 1,
        statusz: 'Hatályos',
        rovid: 'A regisztrációs űrlap mezőit és a GDPR-nyilatkozat szövegét rögzítő dokumentum.',
        leiras:
          'Mezők: név (kötelező), e-mail cím (kötelező), szervezet (opcionális), étkezési igény (opcionális), GDPR-nyilatkozat (kötelező jelölő).',
        elofeltetelek: '',
        kriteriumok: '',
        cia: { c: 2, i: 3, a: 2 },
        hatalyKezdet: '2026-02-01',
        hatalyVeg: null,
        letrehozva: '2026-01-08',
        modositotta: 'Kiss Anna',
        naplo: [
          { mikor: '2026-01-08', ki: 'Kiss Anna', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-01-14', ki: 'Kiss Anna', honnan: 'Vázlat', hova: 'Véleményezés' },
          {
            mikor: '2026-01-22',
            ki: 'Nagy Péter',
            honnan: 'Véleményezés',
            hova: 'Jóváhagyott',
            megj: 'hatály: 2026-02-01 – visszavonásig',
          },
          {
            mikor: '2026-02-01',
            ki: 'RENDSZER',
            honnan: 'Jóváhagyott',
            hova: 'Hatályos',
            megj: 'kezdődátum elérve',
          },
        ],
      },
    ],
  },
  {
    kulcs: 'Terminus-TAPI-TUS-001',
    tipus: 'TUS',
    reteg: 'TAPI',
    cim: 'Regisztrációs adatok fogadása',
    tagek: ['api', 'integráció'],
    verziok: [
      {
        v: 1,
        statusz: 'Hatályos',
        rovid: 'A 3R-ből érkező regisztrációs adatcsomag fogadása és validálása.',
        leiras:
          'A végpont fogadja a 3R Core rétege által küldött regisztrációs adatcsomagot, sémavalidáció után átadja tárolásra, és visszaigazolást küld.',
        elofeltetelek: 'A Terminus-TDB-TD-001 szerinti adatséma rendelkezésre áll.',
        kriteriumok: 'Hibás csomag esetén 400-as válasz. A feldolgozás idempotens.',
        cia: null,
        hatalyKezdet: '2026-03-15',
        hatalyVeg: null,
        letrehozva: '2026-02-20',
        modositotta: 'Varga Dóra',
        naplo: [
          { mikor: '2026-02-20', ki: 'Varga Dóra', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-02-27', ki: 'Varga Dóra', honnan: 'Vázlat', hova: 'Véleményezés' },
          {
            mikor: '2026-03-06',
            ki: 'Nagy Péter',
            honnan: 'Véleményezés',
            hova: 'Jóváhagyott',
            megj: 'hatály: 2026-03-15 – visszavonásig',
          },
          {
            mikor: '2026-03-15',
            ki: 'RENDSZER',
            honnan: 'Jóváhagyott',
            hova: 'Hatályos',
            megj: 'kezdődátum elérve',
          },
        ],
      },
    ],
  },
  {
    kulcs: 'Terminus-TDB-TD-001',
    tipus: 'TD',
    reteg: 'TDB',
    cim: 'Vendég adatcsomag séma',
    tagek: ['séma', 'adat'],
    verziok: [
      {
        v: 1,
        statusz: 'Véleményezés',
        rovid: 'A vendégadatok tárolási sémáját rögzítő technikai dokumentum (JSON).',
        leiras: 'A séma verziókövetett, visszafelé kompatibilis bővítés megengedett.',
        elofeltetelek: '',
        kriteriumok: '',
        cia: { c: 3, i: 3, a: 2 },
        hatalyKezdet: null,
        hatalyVeg: null,
        letrehozva: '2026-05-28',
        modositotta: 'Varga Dóra',
        mellekletek: [
          {
            mid: 'M3',
            tipus: 'csv',
            alt: 'mezokatalogus.csv',
            tartalomHiv: 'seed://Terminus-TDB-TD-001/v1/M3.csv',
          },
        ],
        naplo: [
          { mikor: '2026-05-28', ki: 'Varga Dóra', hova: 'Vázlat', megj: 'létrehozás' },
          { mikor: '2026-06-09', ki: 'Varga Dóra', honnan: 'Vázlat', hova: 'Véleményezés' },
        ],
      },
    ],
  },
];

export const KAPCSOLATOK: NyersKapcsolat[] = [
  { forras: '3R-BUS-002', cel: '3R-TUC-001', fajta: 'lebontja' },
  { forras: '3R-BUS-002', cel: '3R-FE-TUS-002', fajta: 'lebontja' },
  { forras: '3R-TUC-001', cel: '3R-Core-TUS-003', fajta: 'lebontja' },
  { forras: '3R-F-001', cel: '3R-Core-TUS-003', fajta: 'lebontja' },
  { forras: '3R-BUS-002', cel: '3R-BD-001', fajta: 'hivatkozik' },
  { forras: '3R-FE-TUS-002', cel: '3R-Core-TUS-003', fajta: 'függ tőle' },
  { forras: '3R-Core-TUS-003', cel: 'IB-XYT-14-1213', fajta: 'megfelel' },
  { forras: '3R-BUS-002', cel: '3R-BUS-001', fajta: 'leváltja' },
  { forras: '3R-Core-TUS-003', cel: 'Terminus-TAPI-TUS-001', fajta: 'függ tőle' },
  { forras: 'Terminus-TAPI-TUS-001', cel: 'Terminus-TDB-TD-001', fajta: 'hivatkozik' },
];

/** A szabályzat-kódok halmaza — a kapcsolat-transzformáció ezzel dönti el a cél típusát. */
export const SZABALYZAT_KODOK = new Set<string>(SZABALYZATOK.map((s) => s.kod));
