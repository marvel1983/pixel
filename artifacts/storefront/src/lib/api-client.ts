const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const originalFetch = window.fetch.bind(window);

function getCsrfFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  const cookie = getCsrfFromCookie();
  if (cookie) { csrfToken = cookie; return cookie; }
  if (csrfToken) return csrfToken;
  const res = await originalFetch(`${API_BASE}/csrf-token`, { credentials: "include" });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (MUTATION_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    headers.set("x-csrf-token", token);
  }
  return originalFetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
}

window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

  if (MUTATION_METHODS.has(method) && url.includes("/api/")) {
    const token = getCsrfFromCookie();
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", token);
      return originalFetch(input, { ...init, headers, credentials: "include" });
    }
  }
  return originalFetch(input, init);
};
