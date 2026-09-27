/** A szerzőség megállapításához szükséges verzió-mezők (DB-dokumentum és API-válasz egyaránt). */
export interface SzerzoForras {
  modositottaId?: unknown;
  /** Minden tartalom-szerkesztő (a szerkesztés rögzíti). */
  szerkesztok?: readonly unknown[];
  statusznaplo?: readonly { honnan?: string | null; hova: string; ki: unknown }[];
}

const azonosito = (x: unknown): string | null => {
  if (x == null) return null;
  const s = String(x);
  return s && s !== 'RENDSZER' ? s : null;
};

/**
 * A verzió SZERZŐI — egyetlen igazság a négy-szem-elvhez és az értesítés-címzéshez.
 *
 * Szerző: minden tartalom-szerkesztő, a legutóbbi módosító, a létrehozó (forrás nélküli
 * `→ Vázlat` bejegyzés: létrehozás / új verzió nyitása) és a beküldő (`→ Véleményezés`).
 *
 * NEM szerző: a bíráló — a visszadobás (`Véleményezés → Vázlat`, ott a `ki` a bíráló) és a
 * jóváhagyás szereplője —, az ütemező (RENDSZER) és a puszta véleményező. Különben aki egyszer
 * visszadobott egy verziót, az újraküldés után már nem hagyhatná jóvá (holtpont egy-jóváhagyós
 * alkalmazásnál).
 */
export function verzioSzerzoIds(v: SzerzoForras): string[] {
  const h = new Set<string>();
  const add = (x: unknown) => {
    const id = azonosito(x);
    if (id) h.add(id);
  };
  add(v.modositottaId);
  for (const sz of v.szerkesztok ?? []) add(sz);
  for (const n of v.statusznaplo ?? []) {
    const letrehozas = n.hova === 'Vázlat' && !n.honnan;
    if (letrehozas || n.hova === 'Véleményezés') add(n.ki);
  }
  return [...h];
}
