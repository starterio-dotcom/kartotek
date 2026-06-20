import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './kliens';
import type {
  Alkalmazas,
  Elem,
  ElemKapcsolatok,
  HatasRiport,
  Kiadas,
  KiadasTartalom,
  LefedettsegRiport,
  MegfelelesTetel,
  Szolgaltatas,
  TorlesDontes,
} from './tipusok';

export interface ElemSzuro {
  alkalmazasKod?: string;
  tipusKod?: string;
  retegKod?: string;
  statusz?: string;
  cimke?: string;
  kereses?: string;
}

function querystring(szuro: ElemSzuro): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(szuro)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useSzolgaltatasok() {
  return useQuery({ queryKey: ['szolgaltatasok'], queryFn: () => api.get<Szolgaltatas[]>('/api/szolgaltatasok') });
}

export function useAlkalmazasok() {
  return useQuery({ queryKey: ['alkalmazasok'], queryFn: () => api.get<Alkalmazas[]>('/api/alkalmazasok') });
}

export function useFelhasznalok() {
  return useQuery({
    queryKey: ['felhasznalok'],
    queryFn: () => api.get<{ id: string; nev: string; email: string }[]>('/api/felhasznalok'),
    staleTime: 5 * 60_000,
  });
}

export function useElemek(szuro: ElemSzuro) {
  return useQuery({
    queryKey: ['elemek', szuro],
    queryFn: () => api.get<Elem[]>(`/api/elemek${querystring(szuro)}`),
  });
}

export function useElem(id: string | undefined) {
  return useQuery({
    queryKey: ['elem', id],
    queryFn: () => api.get<Elem>(`/api/elemek/${id}`),
    enabled: !!id,
  });
}

export function useGraf(alkalmazasKod: string) {
  const qs = alkalmazasKod ? `?alkalmazasKod=${encodeURIComponent(alkalmazasKod)}` : '';
  return useQuery({
    queryKey: ['graf', alkalmazasKod],
    queryFn: () =>
      api.get<import('../domain/graf').Graf>(`/api/graf${qs}`),
  });
}

export function useElemKapcsolatok(id: string | undefined) {
  return useQuery({
    queryKey: ['elem', id, 'kapcsolatok'],
    queryFn: () => api.get<ElemKapcsolatok>(`/api/elemek/${id}/kapcsolatok`),
    enabled: !!id,
  });
}

/** Egy elemet érintő művelet után frissíti az elem- és listacache-t. */
function useElemMutacio<TBe>(
  fn: (be: TBe) => Promise<Elem>,
  id: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (elem) => {
      qc.setQueryData(['elem', id], elem);
      void qc.invalidateQueries({ queryKey: ['elemek'] });
    },
  });
}

export function useVerzioSzerkesztes(id: string, v: number) {
  return useElemMutacio<{
    cim?: string;
    leirasMd?: string;
    leiras?: unknown;
    cimkek?: string[];
    tipusMezok?: Record<string, unknown>;
  }>((be) => api.patch<Elem>(`/api/elemek/${id}/verziok/${v}`, be), id);
}

export function useLeptetes(id: string, v: number, akcio: string) {
  return useElemMutacio<unknown>(
    (be) => api.post<Elem>(`/api/elemek/${id}/verziok/${v}/${akcio}`, be),
    id,
  );
}

export function useMegjegyzes(id: string, v: number) {
  return useElemMutacio<{ szoveg: string; horgony?: string; valaszMjid?: string }>(
    (be) => api.post<Elem>(`/api/elemek/${id}/verziok/${v}/megjegyzesek`, be),
    id,
  );
}

export function useMegjegyzesMegoldas(id: string, v: number) {
  return useElemMutacio<{ mjid: string }>(
    ({ mjid }) => api.post<Elem>(`/api/elemek/${id}/verziok/${v}/megjegyzesek/${mjid}/megoldas`),
    id,
  );
}

export function useElemLetrehozas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (be: {
      alkalmazasKod: string;
      tipusKod: string;
      retegKod?: string | null;
      cim: string;
      leirasMd?: string;
      cimkek?: string[];
    }) => api.post<Elem>('/api/elemek', be),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['elemek'] }),
  });
}

export function useKapcsolatTorles(elemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kid: string) => api.del<void>(`/api/kapcsolatok/${kid}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['elem', elemId, 'kapcsolatok'] });
      void qc.invalidateQueries({ queryKey: ['graf'] });
    },
  });
}

export function useKapcsolatLetrehozas(elemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (be: Record<string, unknown>) => api.post('/api/kapcsolatok', be),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['elem', elemId, 'kapcsolatok'] });
      void qc.invalidateQueries({ queryKey: ['graf'] });
    },
  });
}

export function useCimkekFrissites(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cimkek: string[]) => api.patch<Elem>(`/api/elemek/${id}/cimkek`, { cimkek }),
    onSuccess: (elem) => {
      qc.setQueryData(['elem', id], elem);
      void qc.invalidateQueries({ queryKey: ['elemek'] });
    },
  });
}

export function useSzolgaltatasLetrehozas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (be: { kod: string; nev: string; leiras?: string }) =>
      api.post<Szolgaltatas>('/api/szolgaltatasok', be),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['szolgaltatasok'] }),
  });
}

export function useAlkalmazasLetrehozas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (be: { kod: string; nev: string; leiras?: string; szolgaltatasKod: string }) =>
      api.post<Alkalmazas>('/api/alkalmazasok', be),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alkalmazasok'] }),
  });
}

export function useAlkalmazasFrissites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kod, ...be }: { kod: string; nev?: string; leiras?: string }) =>
      api.patch<Alkalmazas>(`/api/alkalmazasok/${kod}`, be),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['alkalmazasok'] }),
  });
}

/* ---------- Fázis 6: törlés, riportok, kiadások ---------- */

export function useTorolheto(id: string | undefined) {
  return useQuery({
    queryKey: ['elem', id, 'torolheto'],
    queryFn: () => api.get<TorlesDontes>(`/api/elemek/${id}/torolheto`),
    enabled: !!id,
  });
}

export function useElemTorles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/elemek/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['elemek'] }),
  });
}

export function useHatas(id: string | undefined) {
  return useQuery({
    queryKey: ['elem', id, 'hatas'],
    queryFn: () => api.get<HatasRiport>(`/api/elemek/${id}/hatas`),
    enabled: !!id,
  });
}

export function useLefedettseg(alkalmazasKod: string) {
  const qs = alkalmazasKod ? `?alkalmazasKod=${encodeURIComponent(alkalmazasKod)}` : '';
  return useQuery({
    queryKey: ['riport', 'lefedettseg', alkalmazasKod],
    queryFn: () => api.get<LefedettsegRiport>(`/api/riportok/lefedettseg${qs}`),
  });
}

export function useMegfeleles(alkalmazasKod: string) {
  const qs = alkalmazasKod ? `?alkalmazasKod=${encodeURIComponent(alkalmazasKod)}` : '';
  return useQuery({
    queryKey: ['riport', 'megfeleles', alkalmazasKod],
    queryFn: () => api.get<MegfelelesTetel[]>(`/api/riportok/megfeleles${qs}`),
  });
}

export function useKiadasok() {
  return useQuery({ queryKey: ['kiadasok'], queryFn: () => api.get<Kiadas[]>('/api/kiadasok') });
}

export function useKiadasTartalom(id: string | undefined) {
  return useQuery({
    queryKey: ['kiadas', id, 'tartalom'],
    queryFn: () => api.get<KiadasTartalom>(`/api/kiadasok/${id}/tartalom`),
    enabled: !!id,
  });
}

export function useKiadasLetrehozas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (be: { verzio: string; datum: string }) => api.post<Kiadas>('/api/kiadasok', be),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kiadasok'] }),
  });
}

export function useVerzioKiadas(elemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ v, kiadasId, hozzarendel }: { v: number; kiadasId: string; hozzarendel: boolean }) =>
      api.post<Elem>(`/api/elemek/${elemId}/verziok/${v}/kiadas`, { kiadasId, hozzarendel }),
    onSuccess: (elem) => {
      qc.setQueryData(['elem', elemId], elem);
      void qc.invalidateQueries({ queryKey: ['kiadas'] });
    },
  });
}
