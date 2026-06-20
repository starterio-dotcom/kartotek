import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
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
        onBezar();
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
  }, [onBezar]);

  return (
    <div
      className="modal-hatter"
      onClick={(e) => e.target === e.currentTarget && onBezar()}
    >
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={cim} className="modal">
        <h3>{cim}</h3>
        {children}
      </div>
    </div>
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
