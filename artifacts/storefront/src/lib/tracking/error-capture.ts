import { track } from "./client";

let installed = false;

const STACK_LIMIT = 2000;
const MESSAGE_LIMIT = 500;

/**
 * Known benign browser-noise messages. These fire dozens of times per second
 * when a layout transition oscillates a ResizeObserver, but they never affect
 * what the user sees. Suppressing them keeps the customer-journey panel from
 * being drowned in hundreds of identical "Js Error" entries per session.
 */
const SUPPRESSED_MESSAGE_PATTERNS = [
  /ResizeObserver loop completed with undelivered notifications/i,
  /ResizeObserver loop limit exceeded/i,
];

function isSuppressed(message: string): boolean {
  return SUPPRESSED_MESSAGE_PATTERNS.some((p) => p.test(message));
}

function recordError(message: string, stack?: string, source?: string) {
  if (isSuppressed(message)) return;
  track("js_error", {
    message: message.slice(0, MESSAGE_LIMIT),
    stack: stack ? stack.slice(0, STACK_LIMIT) : null,
    source: source ?? "window",
  });
}

export function installErrorCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Capture phase + stopImmediatePropagation so the ResizeObserver loop event
  // is swallowed before Chrome's devtools / any other listener sees it.
  window.addEventListener(
    "error",
    (ev) => {
      const msg = ev.message ?? ev.error?.message ?? "Unknown error";
      if (isSuppressed(String(msg))) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        return;
      }
      const stack = ev.error?.stack;
      recordError(String(msg), stack, "window.error");
    },
    true,
  );

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg = reason?.message ?? String(reason ?? "Unhandled rejection");
    const stack = reason?.stack;
    recordError(String(msg), stack, "unhandledrejection");
  });
}
