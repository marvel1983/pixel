export interface ActiveProvider { type: string; trackingId: string; }

const API = import.meta.env.VITE_API_URL ?? "/api";
let _cache: ActiveProvider[] | null = null;

export function getProvidersCache(): ActiveProvider[] | null { return _cache; }

export async function fetchProviders(): Promise<ActiveProvider[]> {
  if (_cache) return _cache;
  try {
    const res = await fetch(`${API}/tracking/active`);
    const data = await res.json();
    _cache = data.providers ?? [];
  } catch {
    _cache = [];
  }
  return _cache!;
}
