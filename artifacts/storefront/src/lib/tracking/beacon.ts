import { track, flushNowWithBeacon } from "./client";
import { captureCartSnapshotForTrigger } from "./cart-tracker";

let installed = false;
let lastFiredAt = 0;
const DEBOUNCE_MS = 500;

function onLeaving() {
  // visibilitychange=hidden and pagehide both fire for a single navigation;
  // de-dup within a short window so we record one page_unload per leave.
  const now = Date.now();
  if (now - lastFiredAt < DEBOUNCE_MS) return;
  lastFiredAt = now;

  try {
    captureCartSnapshotForTrigger("page_unload");
    track("page_unload");
  } catch {
    // ignore — best-effort
  }
  flushNowWithBeacon();
}

export function installBeaconHooks(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const visHandler = () => {
    if (document.visibilityState === "hidden") onLeaving();
  };
  document.addEventListener("visibilitychange", visHandler);
  window.addEventListener("pagehide", onLeaving);
}
