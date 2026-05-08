import { startCartTracker } from "./cart-tracker";
import { installBeaconHooks } from "./beacon";
import { installErrorCapture } from "./error-capture";

let booted = false;

export function bootstrapTracking(): void {
  if (booted || typeof window === "undefined") return;
  booted = true;
  startCartTracker();
  installBeaconHooks();
  installErrorCapture();
}
