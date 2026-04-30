import { logger } from "./logger";

/**
 * Posts a message to a Slack incoming webhook. The webhook URL is read from
 * SLACK_WEBHOOK_URL env or, if absent, from siteSettings.slackWebhookUrl when
 * that column is later added. If neither is set, this is a no-op.
 *
 * Failures are swallowed (logged only) — Slack must never block fulfillment work.
 */
export async function notifySlack(message: {
  text: string;
  blocks?: unknown[];
}): Promise<{ sent: boolean; reason?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { sent: false, reason: "no_webhook_configured" };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      logger.warn({ status: res.status }, "Slack webhook returned non-OK");
      return { sent: false, reason: `status_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Slack webhook post failed (non-fatal)");
    return { sent: false, reason: "exception" };
  }
}
