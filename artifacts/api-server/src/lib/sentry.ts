// Sentry stub — real integration requires @opentelemetry/* peer deps.
// Wire up @sentry/node properly when those are resolved.
export const Sentry = {
  captureException(_err: unknown, _ctx?: unknown): void {},
};

export function initSentry(): void {}
