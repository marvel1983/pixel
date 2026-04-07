const BRAND_COLOR = "#3366FF";
const BRAND_BG = "#f8f9fa";

function layout(siteName: string, content: string): string {
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
<p style="margin:4px 0 0;">This is an automated message. Please do not reply directly.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export interface WelcomeData {
  firstName: string;
  siteName: string;
}

export function welcomeEmail(data: WelcomeData): { subject: string; html: string } {
  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Welcome, ${data.firstName}!</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">
Thank you for creating your account at <strong>${data.siteName}</strong>. You now have access to:
</p>
<ul style="color:#495057;line-height:1.8;margin:0 0 24px;padding-left:20px;">
<li>Instant digital delivery of software keys</li>
<li>Order history and license management</li>
<li>Exclusive deals and promotions</li>
<li>Wishlist and product comparison tools</li>
</ul>
<p style="color:#495057;line-height:1.6;margin:0;">
Start browsing our catalog and find the best deals on genuine software licenses.
</p>`;
  return { subject: `Welcome to ${data.siteName}!`, html: layout(data.siteName, content) };
}

export interface OrderConfirmationData {
  siteName: string;
  orderId: number;
  orderRef: string;
  items: { name: string; variant: string; quantity: number; price: string }[];
  total: string;
  customerName: string;
}

export function orderConfirmationEmail(data: OrderConfirmationData): { subject: string; html: string } {
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
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Order Confirmed!</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 8px;">Hi ${data.customerName},</p>
<p style="color:#495057;line-height:1.6;margin:0 0 24px;">
Your order <strong>#${data.orderRef}</strong> has been confirmed. Here's your summary:
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
<tr style="background:#f8f9fa;">
<th style="padding:8px 0;text-align:left;font-size:13px;color:#495057;">Product</th>
<th style="padding:8px 0;text-align:center;font-size:13px;color:#495057;">Qty</th>
<th style="padding:8px 0;text-align:right;font-size:13px;color:#495057;">Price</th>
</tr>
${rows}
</table>
<div style="background:#f8f9fa;padding:16px;border-radius:6px;text-align:right;">
<strong style="font-size:18px;color:#212529;">Total: ${data.total}</strong>
</div>
<p style="color:#868e96;font-size:13px;margin:16px 0 0;">
Your license keys will be delivered in a separate email shortly.
</p>`;
  return { subject: `Order #${data.orderRef} Confirmed - ${data.siteName}`, html: layout(data.siteName, content) };
}

export interface KeyDeliveryData {
  siteName: string;
  orderRef: string;
  customerName: string;
  keys: { productName: string; variant: string; licenseKey: string }[];
}

export function keyDeliveryEmail(data: KeyDeliveryData): { subject: string; html: string } {
  const keyBlocks = data.keys
    .map(
      (k) => `
<div style="margin-bottom:16px;">
<p style="margin:0 0 6px;font-weight:600;color:#212529;">${k.productName} (${k.variant})</p>
<div style="background:#1a1a2e;padding:14px 18px;border-radius:6px;border:1px solid #333;">
<code style="font-family:'Courier New',Courier,monospace;font-size:15px;color:#00d4aa;letter-spacing:0.5px;word-break:break-all;">${k.licenseKey}</code>
</div>
</div>`,
    )
    .join("");

  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Your License Keys</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 8px;">Hi ${data.customerName},</p>
<p style="color:#495057;line-height:1.6;margin:0 0 24px;">
Here are the license keys for order <strong>#${data.orderRef}</strong>:
</p>
${keyBlocks}
<div style="background:#fff3cd;padding:12px 16px;border-radius:6px;border:1px solid #ffc107;margin-top:24px;">
<p style="margin:0;font-size:13px;color:#856404;">
<strong>Important:</strong> Keep your license keys safe. Do not share them publicly.
You can also view your keys anytime in your order history.
</p>
</div>`;
  return { subject: `License Keys for Order #${data.orderRef} - ${data.siteName}`, html: layout(data.siteName, content) };
}

export interface PasswordResetData {
  siteName: string;
  firstName: string;
  resetLink: string;
  expiresIn: string;
}

export function passwordResetEmail(data: PasswordResetData): { subject: string; html: string } {
  const content = `
<h2 style="margin:0 0 16px;color:#212529;font-size:20px;">Reset Your Password</h2>
<p style="color:#495057;line-height:1.6;margin:0 0 16px;">Hi ${data.firstName},</p>
<p style="color:#495057;line-height:1.6;margin:0 0 24px;">
We received a request to reset your password. Click the button below to set a new password:
</p>
<div style="text-align:center;margin:0 0 24px;">
<a href="${data.resetLink}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:14px 36px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
</div>
<p style="color:#868e96;font-size:13px;margin:0 0 8px;">
This link will expire in ${data.expiresIn}. If you didn't request a password reset, you can safely ignore this email.
</p>
<p style="color:#868e96;font-size:12px;margin:0;word-break:break-all;">
Link: ${data.resetLink}
</p>`;
  return { subject: `Password Reset - ${data.siteName}`, html: layout(data.siteName, content) };
}
