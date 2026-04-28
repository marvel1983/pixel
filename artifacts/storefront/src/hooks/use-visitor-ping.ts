import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "/api";
const INTERVAL = 30_000;

function getSessionId(): string {
  let id = sessionStorage.getItem("_vsid");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("_vsid", id);
  }
  return id;
}

export function useVisitorPing() {
  const [location] = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const ping = () => {
      fetch(`${API}/visitors/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          path: locationRef.current,
          referrer: document.referrer,
        }),
      }).catch(() => {});
    };

    ping();
    const id = setInterval(ping, INTERVAL);
    return () => clearInterval(id);
  }, []);
}
