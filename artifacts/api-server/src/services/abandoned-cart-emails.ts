import type { CartSnapshotItem } from "@workspace/db/schema";

const BRAND_COLOR = "#3366FF";
const BRAND_BG = "#f8f9fa";

interface AbandonedCartEmailData {
  emailNumber: number;
  siteName: string;
  items: CartSnapshotItem[];
  total: string;
  recoveryUrl: string;
  unsubscribeUrl: string;
  couponCode?: string;
  discountPercent?: number;
}

function layout(siteName: string, content: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:${BRAND_COLOR};padding:24px 32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${siteName}</h1>
</td></tr>
<tr><td style="padding:32px;">${content}</td></tr>
<tr><td style="background:#f1f3f5;padding:20px 32px;text-align:center;font-size:12px;color:#868e96;">
<p style="margin:0;">© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
<p style="margin:8px 0 0;"><a href="${unsubscribeUrl}" style="color:#868e96;text-decoration:underline;">Unsubscribe from cart reminders</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function renderItems(items: CartSnapshotItem[]): string {
  return items.map((i) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">
        <strong style="color:#212529;">${i.productName}</strong>
        <br><span style="font-size:13px;color:#868e96;">${i.variantName} × ${i.quantity}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#212529;">$${i.priceUsd}</td>
    </tr>`
  ).join("");
}

function ctaButton(url: string, text: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">${text}</a>
</td></tr></table>`;
}

export function abandonedCartEmail(data: AbandonedCartEmailData): { subject: string; html: string } {
  const { emailNumber, siteName, items, total, recoveryUrl, unsubscribeUrl, couponCode, discountPercent } = data;

  const itemsTable = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
${renderItems(items)}
<tr><td style="padding:12px 0;font-weight:700;color:#212529;">Total</td>
<td style="padding:12px 0;text-align:right;font-weight:700;color:#212529;">$${total}</td></tr>
</table>`;

  if (emailNumber === 1) {
    return {
      subject: `You left something behind at ${siteName}!`,
      html: layout(siteName, `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Did you forget something?</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">
We noticed you left some items in your cart. No worries — they're still waiting for you!
</p>
${itemsTable}
${ctaButton(recoveryUrl, "Complete Your Purchase")}
<p style="color:#868e96;font-size:13px;margin:0;">Your cart will be saved for a limited time.</p>
`, unsubscribeUrl),
    };
  }

  if (emailNumber === 2) {
    return {
      subject: `Your cart is expiring soon — ${siteName}`,
      html: layout(siteName, `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Your items are almost gone!</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">
We're holding these items for you, but they won't last forever. Complete your purchase before they're gone.
</p>
${itemsTable}
${ctaButton(recoveryUrl, "Return to Your Cart")}
<p style="color:#868e96;font-size:13px;margin:0;">Prices and availability are subject to change.</p>
`, unsubscribeUrl),
    };
  }

  const couponHtml = couponCode ? `
<div style="background:#f0f7ff;border:2px dashed ${BRAND_COLOR};border-radius:8px;padding:20px;text-align:center;margin:16px 0;">
<p style="margin:0 0 8px;color:#212529;font-weight:600;font-size:16px;">🎉 Special ${discountPercent}% OFF just for you!</p>
<p style="margin:0 0 4px;color:#495057;">Use code at checkout:</p>
<p style="margin:0;font-size:24px;font-weight:700;color:${BRAND_COLOR};letter-spacing:2px;">${couponCode}</p>
</div>` : "";

  return {
    subject: `Last chance: ${discountPercent}% off your cart at ${siteName}!`,
    html: layout(siteName, `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Here's a special offer for you!</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">
We really want you to have these items. As a final gesture, here's an exclusive discount just for you.
</p>
${couponHtml}
${itemsTable}
${ctaButton(recoveryUrl, "Claim Your Discount")}
<p style="color:#868e96;font-size:13px;margin:0;">This offer expires soon. Don't miss out!</p>
`, unsubscribeUrl),
  };
}
