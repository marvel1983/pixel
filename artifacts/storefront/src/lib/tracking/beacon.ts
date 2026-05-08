import { track, flushNowWithBeacon } from "./client";
import { captureCartSnapshotForTrigger } from "./cart-tracker";

let installed = false;

function onLeaving() {
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
