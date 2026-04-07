import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";

interface InviteParams {
  email: string;
  name: string;
  orderNumber: string;
}

export async function scheduleTrustpilotInvite(params: InviteParams) {
  const rows = await db.select().from(siteSettings);
  if (!rows.length) return;
  const s = rows[0];
  if (!s.trustpilotEnabled || !s.trustpilotApiKeyEncrypted || !s.trustpilotBusinessUnitId) return;

  const delayMs = (s.trustpilotInviteDelayDays ?? 3) * 24 * 60 * 60 * 1000;
  setTimeout(async () => {
    try {
      const apiKey = decrypt(s.trustpilotApiKeyEncrypted!);
      const buid = s.trustpilotBusinessUnitId!;
      await fetch(`https://invitations-api.trustpilot.com/v1/private/business-units/${buid}/email-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          consumerEmail: params.email,
          consumerName: params.name,
          referenceNumber: params.orderNumber,
          locale: "en-US",
          senderEmail: s.fromEmail || "noreply@pixelcodes.com",
          senderName: s.siteName || "PixelCodes",
          replyTo: s.supportEmail || s.contactEmail || "support@pixelcodes.com",
          serviceReviewInvitation: {
            templateId: "default",
            redirectUri: s.trustpilotUrl || "https://pixelcodes.com",
          },
        }),
      });
    } catch {
      console.error(`[Trustpilot] Failed to send invite for order ${params.orderNumber}`);
    }
  }, delayMs);
}
