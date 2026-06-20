const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface HealthValasz {
  statusz: 'ok';
  idopont: string;
  db: { readyState: number; csatlakozva: boolean };
}

export async function lekerHealth(): Promise<HealthValasz> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Health hiba: ${res.status}`);
  return (await res.json()) as HealthValasz;
}
