import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Shared client for **USD** store credit balance (`GET /wallet/balance`; API path keeps “wallet”).
 *
 * - **Unauthenticated** (`!token || !user`): `balance` is `null`, `loading` false, `loadFailed` false; `refresh` is a no-op.
 * - **No time-based cache**: every `refresh()` hits the API. The hook also refetches when the browser tab goes from hidden → visible. Call `refresh()` after checkout totals change or from a retry button — not on a TTL.
 * - **Returns**
 *   - `balance`: last known numeric USD balance, or `null` if not loaded / logged out / hard failure before any success.
 *   - `loading`: true only while the **first** in-session fetch is in flight (avoids flicker on later refetches).
 *   - `loadFailed`: true if the latest request ended in HTTP error or network error (cleared on the next successful fetch).
 *   - `refresh()`: idempotent refetch; safe to call when `orderTotal` or window focus changes.
 *
 * Multi-currency: **out of scope** — backend and UI treat wallet as USD only until product adds FX.
 */
export function useWalletBalance() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const authed = Boolean(token && user);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!token || !user) initialFetchDone.current = false;
  }, [token, user]);

  const refresh = useCallback(async () => {
    if (!token || !authed) {
      setBalance(null);
      setLoadFailed(false);
      return;
    }
    const showSpinner = !initialFetchDone.current;
    if (showSpinner) setLoading(true);
    try {
      const r = await fetch(`${API}/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (r.ok) {
        const d = await r.json();
        setBalance(parseFloat(d.balanceUsd) || 0);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
      initialFetchDone.current = true;
    }
  }, [token, authed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Refetch when the user returns to the tab (hidden → visible), not on a timer. */
  useEffect(() => {
    if (!authed) return;
    let wasHidden = document.visibilityState === "hidden";
    const onVis = () => {
      const v = document.visibilityState;
      if (v === "visible" && wasHidden) void refresh();
      wasHidden = v === "hidden";
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authed, refresh]);

  return { balance, loading, loadFailed, refresh };
}
