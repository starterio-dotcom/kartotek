import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Statusz } from '@kartotek/shared';
import type { ElemOsszegzo } from '../api/tipusok';
import { elsodlegesVerzio } from '../domain/verzio';

const MAX_LATHATO = 50;

/** Kis-nagybetű- és ékezetfüggetlen összevetéshez („ertesites" megtalálja az „Értesítés"-t). */
const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface Sor {
  id: string;
  kulcs: string;
  cim: string;
  statusz: Statusz;
  kereso: string;
}

/**
 * Kereshető elemválasztó (ARIA combobox): kulcsra vagy címre szűr, a találat
 * „KULCS — Cím · Státusz" formában látszik. Billentyűzettel: ↑/↓ lép, Enter választ,
 * Esc bezárja a listát (a modált nem).
 */
export function ElemValaszto({
  id,
  elemek,
  ertek,
  onValaszt,
  helyorzo = 'Kezdd el gépelni a kulcsot vagy a címet…',
}: {
  id: string;
  elemek: ElemOsszegzo[];
  ertek: string;
  onValaszt: (elemId: string) => void;
  helyorzo?: string;
}) {
  const sorok = useMemo<Sor[]>(
    () =>
      elemek.map((e) => {
        const v = elsodlegesVerzio(e);
        return { id: e.id, kulcs: e.kulcs, cim: v.cim, statusz: v.statusz, kereso: normal(`${e.kulcs} ${v.cim}`) };
      }),
    [elemek],
  );
  const valasztott = sorok.find((s) => s.id === ertek);
  const [szoveg, setSzoveg] = useState(valasztott ? `${valasztott.kulcs} — ${valasztott.cim}` : '');
  const [nyitva, setNyitva] = useState(false);
  const [aktiv, setAktiv] = useState(0);

  const talalatok = useMemo(() => {
    const q = normal(szoveg.trim());
    // Ha a mező a kiválasztott elem feliratát mutatja, a teljes listát kínáljuk.
    if (!q || (valasztott && szoveg === `${valasztott.kulcs} — ${valasztott.cim}`)) return sorok;
    return sorok.filter((s) => s.kereso.includes(q));
  }, [sorok, szoveg, valasztott]);
  const lathato = talalatok.slice(0, MAX_LATHATO);
  const listaId = `${id}-lista`;
  const opcioId = (s: Sor) => `${id}-opcio-${s.id}`;

  const valaszt = (s: Sor) => {
    onValaszt(s.id);
    setSzoveg(`${s.kulcs} — ${s.cim}`);
    setNyitva(false);
  };

  const billentyu = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!nyitva) setNyitva(true);
      else setAktiv((a) => Math.min(a + 1, lathato.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktiv((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (nyitva && lathato[aktiv]) {
        e.preventDefault();
        valaszt(lathato[aktiv]!);
      }
    } else if (e.key === 'Escape' && nyitva) {
      e.preventDefault(); // a modál Esc-kezelője ezt látja, és nem zár be
      setNyitva(false);
    }
  };

  return (
    <div className="elem-valaszto">
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={nyitva}
        aria-controls={listaId}
        aria-activedescendant={nyitva && lathato[aktiv] ? opcioId(lathato[aktiv]!) : undefined}
        placeholder={helyorzo}
        value={szoveg}
        onChange={(e) => {
          setSzoveg(e.target.value);
          setNyitva(true);
          setAktiv(0);
          if (ertek) onValaszt(''); // a gépelés érvényteleníti a korábbi választást
        }}
        onFocus={() => setNyitva(true)}
        onBlur={() => setNyitva(false)}
        onKeyDown={billentyu}
      />
      {nyitva && (
        <ul id={listaId} role="listbox" className="elem-valaszto-lista" aria-label="Találatok">
          {lathato.length === 0 && <li className="elem-valaszto-ures">Nincs találat.</li>}
          {lathato.map((s, i) => (
            <li
              key={s.id}
              id={opcioId(s)}
              role="option"
              aria-selected={i === aktiv}
              className={`elem-valaszto-opcio${i === aktiv ? ' aktiv' : ''}`}
              // mousedown: a választás a blur (lista-zárás) előtt történjen meg
              onMouseDown={(e) => {
                e.preventDefault();
                valaszt(s);
              }}
              onMouseEnter={() => setAktiv(i)}
            >
              <span className="riport-kulcs">{s.kulcs}</span>
              <span className="elem-valaszto-cim">{s.cim}</span>
              <span className={`badge mini b-${s.statusz}`}>{s.statusz}</span>
            </li>
          ))}
          {talalatok.length > MAX_LATHATO && (
            <li className="elem-valaszto-ures">
              … és még {talalatok.length - MAX_LATHATO} — pontosíts a kereséssel.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
