import { db } from "@workspace/db";
import { siteSettings, trustpilotInvites } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";
import { lte, isNull, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

interface InviteParams {
  email: string;
  name: string;
  orderNumber: string;
}

export async function scheduleTrustpilotInvite(params: InviteParams) {
  const rows = await db.select({
    enabled: siteSettings.trustpilotEnabled,
    hasKey: siteSettings.trustpilotApiKeyEncrypted,
    buid: siteSettings.trustpilotBusinessUnitId,
    delay: siteSettings.trustpilotInviteDelayDays,
  }).from(siteSettings);
  if (!rows.length) return;
  const s = rows[0];
  if (!s.enabled || !s.hasKey || !s.buid) return;

  const delayMs = (s.delay ?? 3) * 24 * 60 * 60 * 1000;
  const scheduledAt = new Date(Date.now() + delayMs);

  await db.insert(trustpilotInvites).values({
    email: params.email,
    name: params.name,
    orderNumber: params.orderNumber,
    scheduledAt,
  });
}

export async function processPendingInvites() {
  const pending = await db.select().from(trustpilotInvites)
    .where(lte(trustpilotInvites.scheduledAt, new Date()))
    .where(isNull(trustpilotInvites.sentAt))
    .where(eq(trustpilotInvites.failed, false))
    .limit(10);

  if (!pending.length) return;

  const rows = await db.select().from(siteSettings);
  if (!rows.length) return;
  const s = rows[0];
  if (!s.trustpilotEnabled || !s.trustpilotApiKeyEncrypted || !s.trustpilotBusinessUnitId) return;

  const apiKey = decrypt(s.trustpilotApiKeyEncrypted);
  const buid = s.trustpilotBusinessUnitId;

  for (const invite of pending) {
    try {
      const response = await fetch(
        `https://invitations-api.trustpilot.com/v1/private/business-units/${buid}/email-invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            consumerEmail: invite.email,
            consumerName: invite.name,
            referenceNumber: invite.orderNumber,
            locale: "en-US",
            senderEmail: s.fromEmail || "noreply@pixelcodes.com",
            senderName: s.siteName || "PixelCodes",
            replyTo: s.supportEmail || s.contactEmail || "support@pixelcodes.com",
            serviceReviewInvitation: {
              templateId: "default",
              redirectUri: s.trustpilotUrl || "https://pixelcodes.com",
            },
          }),
        }
      );
      if (response.ok) {
        await db.update(trustpilotInvites).set({ sentAt: new Date() }).where(eq(trustpilotInvites.id, invite.id));
      } else {
        const errText = await response.text();
        await db.update(trustpilotInvites).set({ failed: true, lastError: errText.slice(0, 500) })
          .where(eq(trustpilotInvites.id, invite.id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await db.update(trustpilotInvites).set({ failed: true, lastError: msg.slice(0, 500) })
        .where(eq(trustpilotInvites.id, invite.id));
      logger.error({ err, inviteId: invite.id }, "Trustpilot invite send failed");
    }
  }
}
