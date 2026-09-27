/** Az audit-napló megjelenítési logikája (tiszta függvények). */

export type AuditEsemeny = 'modositas' | 'hozzaferes-megtagadva' | 'olvasas';

/** Az esemény kiírt felirata — a jelentést soha nem csak a szín hordozza. */
export const ESEMENY_FELIRAT: Record<AuditEsemeny, string> = {
  modositas: 'Módosítás',
  'hozzaferes-megtagadva': 'Elutasított hozzáférés',
  olvasas: 'Olvasás',
};

const V = '/api/elemek/:id/verziok/:v';

/** Útvonal-minta + metódus → emberi műveletnév. */
const MUVELETEK: Record<string, string> = {
  'POST /api/elemek': 'Elem létrehozása',
  'GET /api/elemek': 'Elemlista lekérése',
  'GET /api/elemek/:id': 'Elem megtekintése',
  'DELETE /api/elemek/:id': 'Elem törlése',
  'PATCH /api/elemek/:id/cimkek': 'Címkék módosítása',
  [`PATCH ${V}`]: 'Verzió szerkesztése',
  [`POST ${V}/bekuldes`]: 'Beküldés véleményezésre',
  [`POST ${V}/visszavonas`]: 'Beküldés visszavonása',
  [`POST ${V}/jovahagyas`]: 'Jóváhagyás',
  [`POST ${V}/visszadobas`]: 'Visszadobás',
  [`POST ${V}/elvetes`]: 'Elvetés',
  [`POST ${V}/kivezetes`]: 'Kivezetés',
  [`POST ${V}/archivalas`]: 'Archiválás',
  [`POST ${V}/ujverzio`]: 'Új verzió nyitása',
  [`POST ${V}/kiadas`]: 'Kiadás-hozzárendelés',
  [`POST ${V}/megjegyzesek`]: 'Megjegyzés írása',
  [`POST ${V}/megjegyzesek/:mjid/megoldas`]: 'Megjegyzés lezárása',
  [`POST ${V}/mellekletek`]: 'Melléklet feltöltése',
  [`POST ${V}/mellekletek/figma`]: 'Figma-hivatkozás felvétele',
  [`DELETE ${V}/mellekletek/:mid`]: 'Melléklet törlése',
  [`GET ${V}/mellekletek/:mid/tartalom`]: 'Melléklet megnyitása',
  'POST /api/kapcsolatok': 'Kapcsolat felvétele',
  'DELETE /api/kapcsolatok/:id': 'Kapcsolat törlése',
  'GET /api/felhasznalok': 'Felhasználólista megtekintése',
  'PATCH /api/felhasznalok/:id': 'Szerepkör-módosítás',
  'POST /api/szolgaltatasok': 'Szolgáltatás létrehozása',
  'PATCH /api/szolgaltatasok/:kod': 'Szolgáltatás módosítása',
  'POST /api/alkalmazasok': 'Alkalmazás létrehozása',
  'PATCH /api/alkalmazasok/:kod': 'Alkalmazás módosítása',
  'POST /api/kiadasok': 'Kiadás létrehozása',
  'GET /api/kiadasok/:id/tartalom': 'Kiadás tartalmának megtekintése',
  'POST /api/utemezo/futtat': 'Ütemező kézi futtatása',
  'GET /api/audit': 'Audit-napló lekérdezése',
  'GET /api/export/csv': 'Export (CSV)',
  'GET /api/export/reqif': 'Export (ReqIF)',
  'GET /api/ertesitesek': 'Értesítések lekérése',
  'POST /api/elemek/:id/jogi-zarolas': 'Jogi zárolás elrendelése / feloldása',
};

export function muveletCimke(metodus: string, utvonal: string, esemeny?: AuditEsemeny): string {
  // A query-t a napló szándékosan nem tárolja, így a lista-nézetet az esemény dönti el:
  // az elemlista csak TELJES nézetben számít naplózott olvasásnak.
  if (metodus === 'GET' && utvonal === '/api/elemek' && esemeny === 'olvasas')
    return 'Teljes elemlista (dosszié)';
  return MUVELETEK[`${metodus} ${utvonal}`] ?? `${metodus} ${utvonal}`;
}

/** A HTTP-eredmény rövid, kiírt felirata. */
export function eredmenyCimke(statusz: number): string {
  if (statusz >= 200 && statusz < 300) return 'Sikeres';
  if (statusz === 401) return 'Nincs bejelentkezve';
  if (statusz === 403) return 'Nincs jogosultság';
  if (statusz === 404) return 'Nem található';
  if (statusz === 409) return 'Ütközés';
  if (statusz >= 400 && statusz < 500) return 'Elutasítva';
  return 'Szerverhiba';
}
