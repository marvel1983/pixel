import { et } from "./email-i18n";

const BRAND_COLOR = "#3366FF";
const BRAND_BG = "#f8f9fa";

interface LayoutOptions {
  siteName: string;
  logoUrl?: string | null;
  locale?: string;
}

function layout(opts: LayoutOptions, content: string): string {
  const { siteName, logoUrl, locale = "en" } = opts;
  const lang = locale.slice(0, 2);
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${siteName}" style="max-height:40px;margin-bottom:8px;" /><br>`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
<tr><td style="background:${BRAND_COLOR};padding:24px 32px;text-align:center;">
${logoHtml}<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${siteName}</h1>
</td></tr>
<tr><td style="padding:32px;">${content}</td></tr>
<tr><td style="background:#f1f3f5;padding:20px 32px;text-align:center;font-size:12px;color:#868e96;">
<p style="margin:0;">© ${new Date().getFullYear()} ${siteName}. ${et(lang, "email.footer.rights")}</p>
<p style="margin:4px 0 0;">${et(lang, "email.footer.auto")}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export interface WelcomeData {
  firstName: string;
  siteName: string;
  logoUrl?: string | null;
  locale?: string;
}

export function welcomeEmail(data: WelcomeData): { subject: string; html: string } {
  const lang = data.locale ?? "en";
  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">${et(lang, "email.welcome.title", { firstName: data.firstName })}</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">
${et(lang, "email.welcome.body", { siteName: data.siteName })}
</p>
<ul style="color:#495057;line-height:1.8;margin:0 0 24px;padding-left:20px;">
<li>${et(lang, "email.welcome.feature1")}</li>
<li>${et(lang, "email.welcome.feature2")}</li>
<li>${et(lang, "email.welcome.feature3")}</li>
<li>${et(lang, "email.welcome.feature4")}</li>
</ul>
<p style="color:#495057;line-height:1.6;margin:0;">
${et(lang, "email.welcome.cta")}
</p>`;
  return {
    subject: et(lang, "email.welcome.subject", { siteName: data.siteName }),
    html: layout({ siteName: data.siteName, logoUrl: data.logoUrl, locale: lang }, content),
  };
}

export interface OrderConfirmationData {
  siteName: string;
  logoUrl?: string | null;
  orderId: number;
  orderRef: string;
  items: { name: string; variant: string; quantity: number; price: string }[];
  total: string;
  customerName: string;
  locale?: string;
}

export function orderConfirmationEmail(data: OrderConfirmationData): { subject: string; html: string } {
  const lang = data.locale ?? "en";
  const rows = data.items
    .map(
      (item) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #e9ecef;color:#495057;">${item.name}<br><span style="font-size:12px;color:#868e96;">${item.variant}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #e9ecef;text-align:center;color:#495057;">${item.quantity}</td>
<td style="padding:8px 0;border-bottom:1px solid #e9ecef;text-align:right;color:#495057;">${item.price}</td>
</tr>`,
    )
    .join("");

  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">${et(lang, "email.order.title")}</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 8px;">${et(lang, "email.order.greeting", { name: data.customerName })}</p>
<p style="color:#495057;line-height:1.6;margin:0 0 24px;">
${et(lang, "email.order.body", { orderRef: data.orderRef })}
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr style="background:#f8f9fa;">
<th style="padding:8px 0;text-align:left;font-size:13px;color:#495057;">${et(lang, "email.order.product")}</th>
<th style="padding:8px 0;text-align:center;font-size:13px;color:#495057;">${et(lang, "email.order.qty")}</th>
<th style="padding:8px 0;text-align:right;font-size:13px;color:#495057;">${et(lang, "email.order.price")}</th>
</tr>
${rows}
</table>
<div style="background:#f8f9fa;padding:16px;border-radius:6px;text-align:right;">
<strong style="font-size:18px;color:#212529;">${et(lang, "email.order.total", { total: data.total })}</strong>
</div>
<p style="color:#868e96;font-size:13px;margin:16px 0 0;">
${et(lang, "email.order.keysNote")}
</p>`;
  return {
    subject: et(lang, "email.order.subject", { orderRef: data.orderRef, siteName: data.siteName }),
    html: layout({ siteName: data.siteName, logoUrl: data.logoUrl, locale: lang }, content),
  };
}

export interface KeyDeliveryData {
  siteName: string;
  logoUrl?: string | null;
  orderRef: string;
  customerName: string;
  keys: { productName: string; variant: string; licenseKey: string; instructions?: string | null }[];
  locale?: string;
  backorderNote?: string; // shown when partial keys delivered; remaining are on backorder
}

export function keyDeliveryEmail(data: KeyDeliveryData): { subject: string; html: string } {
  const lang = data.locale ?? "en";
  const keyBlocks = data.keys
    .map(
      (k) => `
<div style="margin-bottom:20px;">
<p style="margin:0 0 6px;font-weight:600;color:#212529;">${k.productName} (${k.variant})</p>
<div style="background:#1a1a2e;padding:14px 18px;border-radius:6px;border:1px solid #333;">
<code style="font-family:'Courier New',Courier,monospace;font-size:15px;color:#00d4aa;letter-spacing:0.5px;word-break:break-all;">${k.licenseKey}</code>
</div>
${k.instructions ? `<div style="margin-top:10px;background:#f0f4ff;padding:12px 16px;border-radius:6px;border-left:3px solid #3b82f6;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;">How to activate</p><p style="margin:0;font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;">${k.instructions}</p></div>` : ""}
</div>`,
    )
    .join("");

  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">${et(lang, "email.keys.title")}</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 8px;">${et(lang, "email.order.greeting", { name: data.customerName })}</p>
<p style="color:#495057;line-height:1.6;margin:0 0 24px;">
${et(lang, "email.keys.body", { orderRef: data.orderRef })}
</p>
${keyBlocks}
${data.backorderNote ? `<div style="background:#fff8e1;padding:12px 16px;border-radius:6px;border:1px solid #f59e0b;margin-top:16px;margin-bottom:8px;"><p style="margin:0;font-size:13px;color:#92400e;">⏳ ${data.backorderNote}</p></div>` : ""}
<div style="background:#fff3cd;padding:12px 16px;border-radius:6px;border:1px solid #ffc107;margin-top:${data.backorderNote ? "8px" : "24px"}">
<p style="margin:0;font-size:13px;color:#856404;">
${et(lang, "email.keys.warning")}
</p>
</div>`;
  return {
    subject: et(lang, "email.keys.subject", { orderRef: data.orderRef, siteName: data.siteName }),
    html: layout({ siteName: data.siteName, logoUrl: data.logoUrl, locale: lang }, content),
  };
}

export interface PasswordResetData {
  siteName: string;
  logoUrl?: string | null;
  firstName: string;
  resetLink: string;
  expiresIn: string;
  locale?: string;
}

export function passwordResetEmail(data: PasswordResetData): { subject: string; html: string } {
  const lang = data.locale ?? "en";
  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">${et(lang, "email.reset.title")}</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">${et(lang, "email.order.greeting", { name: data.firstName })}</p>
<p style="color:#495057;line-height:1.6;margin:0 0 24px;">
${et(lang, "email.reset.body")}
</p>
<div style="text-align:center;margin:0 0 24px;">
<a href="${data.resetLink}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${et(lang, "email.reset.button")}</a>
</div>
<p style="color:#868e96;font-size:13px;margin:0 0 8px;">
${et(lang, "email.reset.expiry", { expiresIn: data.expiresIn })}
</p>
<p style="color:#868e96;font-size:12px;margin:0;word-break:break-all;">
Link: ${data.resetLink}
</p>`;
  return {
    subject: et(lang, "email.reset.subject", { siteName: data.siteName }),
    html: layout({ siteName: data.siteName, logoUrl: data.logoUrl, locale: lang }, content),
  };
}
