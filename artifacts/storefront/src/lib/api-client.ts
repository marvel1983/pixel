const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const API_BASE_NORMALIZED = API_BASE.replace(/\/$/, "");

function joinApiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_NORMALIZED}${p}`;
}
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const originalFetch = window.fetch.bind(window);

/** True when `url` targets our API (relative /api or absolute VITE_API_URL), for CSRF + 401 handling. */
function urlTargetsApi(url: string): boolean {
  try {
    const resolved = new URL(url, window.location.origin);
    if (API_BASE.startsWith("http")) {
      const baseUrl = new URL(API_BASE_NORMALIZED.endsWith("/") ? API_BASE_NORMALIZED : `${API_BASE_NORMALIZED}/`);
      return resolved.origin === baseUrl.origin && resolved.pathname.startsWith(baseUrl.pathname.replace(/\/$/, "") || "/");
    }
    const prefix = API_BASE_NORMALIZED.startsWith("/") ? API_BASE_NORMALIZED : `/${API_BASE_NORMALIZED}`;
    return resolved.pathname === prefix || resolved.pathname.startsWith(`${prefix}/`);
  } catch {
    return url.includes("/api/");
  }
}

function getCsrfFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

let csrfToken: string | null = null;

async function ensureCsrfToken(): Promise<string> {
  const cookie = getCsrfFromCookie();
  if (cookie) { csrfToken = cookie; return cookie; }
  if (csrfToken) return csrfToken;
  const res = await originalFetch(joinApiPath("/csrf-token"), { credentials: "include" });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers();
  const inc = options.headers;
  if (inc instanceof Headers) {
    inc.forEach((value, key) => headers.set(key, value));
  } else if (inc && typeof inc === "object" && !Array.isArray(inc)) {
    for (const [k, v] of Object.entries(inc as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      headers.set(k, String(v));
    }
  }
  if (MUTATION_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    headers.set("x-csrf-token", token);
  }
  return originalFetch(joinApiPath(path), { ...options, headers, credentials: "include" });
}

window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

  let response: Response;
  if (MUTATION_METHODS.has(method) && urlTargetsApi(url)) {
    const headers = new Headers();
    const inc = init?.headers;
    if (inc instanceof Headers) {
      inc.forEach((value, key) => headers.set(key, value));
    } else if (inc && typeof inc === "object" && !Array.isArray(inc)) {
      for (const [k, v] of Object.entries(inc as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        headers.set(k, String(v));
      }
    }
    if (!headers.has("x-csrf-token")) {
      const token = await ensureCsrfToken();
      headers.set("x-csrf-token", token);
    }
    response = await originalFetch(input, { ...init, headers, credentials: "include" });
  } else {
    response = await originalFetch(input, init);
  }

  // Auto-logout on 401 from any /api/ call
  if (response.status === 401 && urlTargetsApi(url) && !url.includes("/api/auth/")) {
    const { useAuthStore } = await import("@/stores/auth-store");
    useAuthStore.getState().logout();
  }

  return response;
};
