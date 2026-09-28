import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Lenyíló menü (disclosure-minta): gomb `aria-expanded`-del, a panel kattintásra a gomb
 * alatt nyílik; kívülre kattintva vagy Esc-re bezárul, és a fókusz visszatér a gombra.
 * A tartalom a `bezar` függvényt kapja, hogy egy választás után bezárhassa a panelt.
 */
export function Legordulo({
  cimke,
  children,
  className = '',
}: {
  cimke: ReactNode;
  children: (bezar: () => void) => ReactNode;
  className?: string;
}) {
  const [nyitva, setNyitva] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const gomb = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!nyitva) return;
    const kattint = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setNyitva(false);
    };
    const billentyu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNyitva(false);
        gomb.current?.focus();
      }
    };
    document.addEventListener('mousedown', kattint);
    document.addEventListener('keydown', billentyu);
    return () => {
      document.removeEventListener('mousedown', kattint);
      document.removeEventListener('keydown', billentyu);
    };
  }, [nyitva]);

  return (
    <div className={`legordulo ${className}`} ref={wrap}>
      <button
        ref={gomb}
        type="button"
        className="gomb masodlagos"
        aria-expanded={nyitva}
        aria-controls={panelId}
        onClick={() => setNyitva((x) => !x)}
      >
        {cimke} <span aria-hidden="true">▾</span>
      </button>
      {nyitva && (
        <div id={panelId} className="legordulo-panel">
          {children(() => setNyitva(false))}
        </div>
      )}
    </div>
  );
}
