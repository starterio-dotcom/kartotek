import { useSyncExternalStore } from 'react';

/**
 * Központi felületi visszajelzés (toast). Minden sikeres művelet rövid megerősítést,
 * minden hiba olvasható üzenetet kap — a felület soha nem „néma".
 * Modul-szintű tár, hogy komponensen kívülről (pl. a MutationCache-ből) is hívható legyen.
 */
export type UzenetFajta = 'siker' | 'hiba';

export interface UzenetAkcio {
  cimke: string;
  fut: () => void;
}

export interface Uzenet {
  id: number;
  fajta: UzenetFajta;
  szoveg: string;
  akcio?: UzenetAkcio;
}

const MAX_LATHATO = 4;
let lista: Uzenet[] = [];
let kovetkezo = 1;
const figyelok = new Set<() => void>();
const ertesit = () => figyelok.forEach((f) => f());

export function uzenetBezar(id: number): void {
  if (!lista.some((u) => u.id === id)) return;
  lista = lista.filter((u) => u.id !== id);
  ertesit();
}

function hozzaad(fajta: UzenetFajta, szoveg: string, akcio?: UzenetAkcio): number {
  const id = kovetkezo++;
  lista = [...lista.slice(-(MAX_LATHATO - 1)), { id, fajta, szoveg, ...(akcio ? { akcio } : {}) }];
  ertesit();
  // A hiba tovább marad (el kell tudni olvasni); a visszavonható művelet is ad időt a döntésre.
  const ido = fajta === 'hiba' ? 10_000 : akcio ? 8_000 : 4_500;
  setTimeout(() => uzenetBezar(id), ido);
  return id;
}

export const uzenet = {
  siker: (szoveg: string, akcio?: UzenetAkcio) => hozzaad('siker', szoveg, akcio),
  hiba: (szoveg: string) => hozzaad('hiba', szoveg),
};

/** Teszteléshez: a tár ürítése. */
export function uzenetekUrites(): void {
  lista = [];
  ertesit();
}

function feliratkozas(f: () => void) {
  figyelok.add(f);
  return () => figyelok.delete(f);
}

export function useUzenetek(): Uzenet[] {
  return useSyncExternalStore(feliratkozas, () => lista, () => lista);
}

function UzenetKartya({ u }: { u: Uzenet }) {
  return (
    <div className={`uzenet uzenet-${u.fajta}`}>
      <span className="uzenet-ikon" aria-hidden="true">{u.fajta === 'hiba' ? '!' : '✓'}</span>
      <span className="uzenet-szoveg">{u.szoveg}</span>
      {u.akcio && (
        <button
          className="uzenet-akcio"
          onClick={() => {
            u.akcio!.fut();
            uzenetBezar(u.id);
          }}
        >
          {u.akcio.cimke}
        </button>
      )}
      <button className="uzenet-bezar" aria-label="Üzenet bezárása" onClick={() => uzenetBezar(u.id)}>
        ✕
      </button>
    </div>
  );
}

/**
 * A két élő régió MINDIG a DOM-ban van (a képernyőolvasó csak a már meglévő régió
 * változását olvassa fel): a siker udvarias (status), a hiba azonnali (alert).
 */
export function UzenetSav() {
  const uzenetek = useUzenetek();
  return (
    <div className="uzenet-sav">
      <div role="status" aria-live="polite" className="uzenet-regio">
        {uzenetek.filter((u) => u.fajta === 'siker').map((u) => <UzenetKartya key={u.id} u={u} />)}
      </div>
      <div role="alert" className="uzenet-regio">
        {uzenetek.filter((u) => u.fajta === 'hiba').map((u) => <UzenetKartya key={u.id} u={u} />)}
      </div>
    </div>
  );
}
