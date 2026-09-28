import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Statusz } from '@kartotek/shared';

/** A státusz MINDIG felirattal jelenik meg (a `.badge::before` csak egy pötty) — EN 301 549. */
export function StatuszJelveny({
  statusz,
  meret,
}: {
  statusz: Statusz;
  meret?: 'mini' | 'nagy';
}) {
  return <span className={`badge b-${statusz}${meret ? ' ' + meret : ''}`}>{statusz}</span>;
}

export function Betolto({ szoveg = 'Betöltés…' }: { szoveg?: string }) {
  return (
    <p className="betolto" role="status">
      {szoveg}
    </p>
  );
}

export function Hiba({ uzenet }: { uzenet: string }) {
  return (
    <p className="hiba-doboz" role="alert">
      {uzenet}
    </p>
  );
}

export function Ures({ szoveg }: { szoveg: string }) {
  return (
    <div className="torzs">
      <span className="ures">{szoveg}</span>
    </div>
  );
}

type GombProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  valtozat?: 'elsodleges' | 'masodlagos' | 'veszelyes' | 'halk';
};

export function Gomb({ valtozat = 'masodlagos', className = '', ...rest }: GombProps) {
  return <button {...rest} className={`gomb ${valtozat} ${className}`} />;
}

export function Modal({
  cim,
  children,
  onBezar,
}: {
  cim: string;
  children: ReactNode;
  onBezar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // A hívók jellemzően inline függvényt adnak át; ha ez függőség lenne, minden szülő-
  // újrarenderelés (pl. „folyamatban" állapot) újrafuttatná az effektet → a fókusz
  // kiugrana a modálból, majd vissza az első mezőre. Ezért ref-ből hívjuk.
  const bezarRef = useRef(onBezar);
  bezarRef.current = onBezar;
  useEffect(() => {
    // A megnyitáskor fókuszált elem, hogy bezáráskor visszaadhassuk a fókuszt.
    const elozoFokusz = document.activeElement as HTMLElement | null;

    const fokuszalhatok = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const kezelo = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return; // egy belső vezérlő (pl. lenyíló lista) már kezelte
        bezarRef.current();
        return;
      }
      // Fókuszcsapda: a Tab nem hagyhatja el a modált (EN 301 549, 2.4.3).
      if (e.key === 'Tab') {
        const elemek = fokuszalhatok();
        if (elemek.length === 0) return;
        const elso = elemek[0]!;
        const utolso = elemek[elemek.length - 1]!;
        const aktiv = document.activeElement;
        if (e.shiftKey && aktiv === elso) {
          e.preventDefault();
          utolso.focus();
        } else if (!e.shiftKey && aktiv === utolso) {
          e.preventDefault();
          elso.focus();
        }
      }
    };

    document.addEventListener('keydown', kezelo);
    // Az első fókuszálható elemre állunk, vagy a dialógusra.
    (fokuszalhatok()[0] ?? ref.current)?.focus();
    return () => {
      document.removeEventListener('keydown', kezelo);
      elozoFokusz?.focus?.();
    };
  }, []);

  // Portálon a <body>-ba: a `backdrop-filter`-es szülő (pl. a ragadós kartoték-fejléc) a
  // `position:fixed` gyerekének saját befoglaló blokkot adna → a dialógus a fejléc-sávhoz
  // igazodna, a teteje levágódna. A body-ban mindig a nézetablakhoz igazodik.
  return createPortal(
    <div
      className="modal-hatter"
      onClick={(e) => e.target === e.currentTarget && onBezar()}
    >
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={cim} className="modal">
        <h3>{cim}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Megerősítő dialógus visszafordíthatatlan / következményes művelethez: a szöveg
 * leírja a következményt, a gomb a művelet nevét viseli (nem általános „OK").
 */
export function Megerosites({
  cim,
  children,
  gombFelirat,
  veszelyes = false,
  folyamatban = false,
  hiba,
  onMegse,
  onMegerosit,
}: {
  cim: string;
  children: ReactNode;
  gombFelirat: string;
  veszelyes?: boolean;
  folyamatban?: boolean;
  hiba?: string | null;
  onMegse: () => void;
  onMegerosit: () => void;
}) {
  return (
    <Modal cim={cim} onBezar={onMegse}>
      <div className="megerosites-szoveg">{children}</div>
      {hiba && <Hiba uzenet={hiba} />}
      <div className="modal-gombok">
        <button className="btn masodlagos" onClick={onMegse}>Mégse</button>
        <button className={`btn${veszelyes ? ' veszelyes' : ''}`} disabled={folyamatban} onClick={onMegerosit}>
          {folyamatban ? `${gombFelirat}…` : gombFelirat}
        </button>
      </div>
    </Modal>
  );
}

export function Mezo({ cimke, children }: { cimke: string; children: ReactNode }) {
  return (
    <label>
      {cimke}
      {children}
    </label>
  );
}

/** Általános beviteli mező osztály (a modalon kívüli űrlapokhoz). */
export const beviteliStilus = 'mezo-be';
