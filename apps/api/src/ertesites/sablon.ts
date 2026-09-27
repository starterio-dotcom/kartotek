export type ErtesitesEsemeny = 'bekuldes' | 'jovahagyas' | 'visszadobas' | 'megjegyzes';

export interface SablonAdat {
  esemeny: ErtesitesEsemeny;
  elemKulcs: string;
  verzioSzam: number;
  cim: string;
  kiNev: string;
  /** Visszadobás indoklása / a megjegyzés szövege / a jóváhagyás hatálya. */
  reszlet?: string;
  hivatkozas: string;
}

export interface ErtesitesSzoveg {
  /** E-mail tárgy. */
  targy: string;
  /** Egysoros üzenet a felületi értesítéshez. */
  uzenet: string;
  szoveg: string;
  html: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A megjegyzés/indoklás rövidítve az egysoros üzenetbe. */
const rovidit = (s: string, max = 140) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const FEJ: Record<ErtesitesEsemeny, (a: SablonAdat) => { targy: string; uzenet: string }> = {
  bekuldes: (a) => ({
    targy: `Véleményezésre vár: ${a.elemKulcs} v${a.verzioSzam}`,
    uzenet: `${a.kiNev} véleményezésre küldte: ${a.cim}`,
  }),
  jovahagyas: (a) => ({
    targy: `Jóváhagyva: ${a.elemKulcs} v${a.verzioSzam}`,
    uzenet: `${a.kiNev} jóváhagyta${a.reszlet ? ` (${a.reszlet})` : ''}: ${a.cim}`,
  }),
  visszadobas: (a) => ({
    targy: `Visszadobva: ${a.elemKulcs} v${a.verzioSzam}`,
    uzenet: `${a.kiNev} visszadobta: ${a.cim}${a.reszlet ? ` — „${rovidit(a.reszlet)}"` : ''}`,
  }),
  megjegyzes: (a) => ({
    targy: `Új megjegyzés: ${a.elemKulcs} v${a.verzioSzam}`,
    uzenet: `${a.kiNev} megjegyzést írt${a.reszlet ? `: „${rovidit(a.reszlet)}"` : ''}`,
  }),
};

/** Az értesítés szövegei (felület + e-mail). A felhasználói tartalom HTML-ben escape-elve. */
export function ertesitesSzoveg(a: SablonAdat): ErtesitesSzoveg {
  const { targy, uzenet } = FEJ[a.esemeny](a);
  const reszletSor =
    a.reszlet && (a.esemeny === 'visszadobas' || a.esemeny === 'megjegyzes') ? `\n\n„${a.reszlet}"` : '';
  const szoveg =
    `${uzenet}\n\n${a.elemKulcs} v${a.verzioSzam} — ${a.cim}${reszletSor}\n\n` +
    `Megnyitás: ${a.hivatkozas}\n\n— Kartotékrendszer (automatikus értesítés)`;
  const html =
    `<p>${esc(uzenet)}</p>` +
    `<p><b>${esc(a.elemKulcs)} v${a.verzioSzam}</b> — ${esc(a.cim)}</p>` +
    (reszletSor ? `<blockquote>${esc(a.reszlet!)}</blockquote>` : '') +
    `<p><a href="${esc(a.hivatkozas)}">Megnyitás a Kartotékrendszerben</a></p>` +
    `<p style="color:#5C6677;font-size:12px">— Kartotékrendszer (automatikus értesítés)</p>`;
  return { targy, uzenet, szoveg, html };
}
