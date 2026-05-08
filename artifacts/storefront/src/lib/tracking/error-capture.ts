import { track } from "./client";

let installed = false;

const STACK_LIMIT = 2000;
const MESSAGE_LIMIT = 500;

function recordError(message: string, stack?: string, source?: string) {
  track("js_error", {
    message: message.slice(0, MESSAGE_LIMIT),
    stack: stack ? stack.slice(0, STACK_LIMIT) : null,
    source: source ?? "window",
  });
}

export function installErrorCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    const msg = ev.message ?? ev.error?.message ?? "Unknown error";
    const stack = ev.error?.stack;
    recordError(String(msg), stack, "window.error");
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg = reason?.message ?? String(reason ?? "Unhandled rejection");
    const stack = reason?.stack;
    recordError(String(msg), stack, "unhandledrejection");
  });
}
