import type { GasData } from '../types';

const API_BASE = 'http://localhost:8000';

export async function fetchGasData(): Promise<GasData> {
  const resp = await fetch(`${API_BASE}/api/gas-data`);
  if (!resp.ok) throw new Error(`Сервер вернул ${resp.status}`);
  const json = await resp.json();
  if (json.error) throw new Error(json.error);
  return json as GasData;
}
