import { useEffect } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export function useReferralTracking() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;

    const tracked = sessionStorage.getItem("ref_tracked");
    if (tracked === ref) return;

    fetch(`${API}/affiliate-track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: ref, landingPage: window.location.pathname }),
    }).then((r) => {
      if (r.ok) sessionStorage.setItem("ref_tracked", ref);
    }).catch(() => {});
  }, []);
}
