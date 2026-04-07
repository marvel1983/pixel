function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<div style="background:#2563eb;padding:20px 24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">PixelCodes</h1></div>
<div style="padding:24px">${content}</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px">
PixelCodes — Your trusted source for digital software keys
</div></div></div></body></html>`;
}

interface ConfirmParams {
  confirmUrl: string;
}

export function confirmationEmail(p: ConfirmParams): { subject: string; html: string } {
  const content = `
<h2 style="margin:0 0 16px;color:#111827">Confirm Your Subscription</h2>
<p style="color:#4b5563;margin:0 0 20px">Thank you for subscribing to the PixelCodes newsletter! Please confirm your email address by clicking the button below.</p>
<div style="text-align:center;margin:24px 0">
<a href="${esc(p.confirmUrl)}" style="display:inline-block;padding:14px 36px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Confirm Subscription</a>
</div>
<p style="color:#9ca3af;font-size:12px;margin:0">If you did not subscribe, you can safely ignore this email.</p>`;
  return { subject: "Confirm your PixelCodes newsletter subscription", html: wrap(content) };
}

interface WelcomeParams {
  discountCode?: string;
  unsubUrl: string;
}

export function welcomeEmail(p: WelcomeParams): { subject: string; html: string } {
  const discountBlock = p.discountCode
    ? `<div style="padding:16px;background:#f0fdf4;border-radius:8px;margin:0 0 20px;text-align:center">
<p style="margin:0 0 8px;font-weight:600;color:#111827">Your Exclusive Discount Code:</p>
<p style="margin:0;font-size:24px;font-weight:bold;color:#16a34a;letter-spacing:2px">${esc(p.discountCode)}</p>
<p style="margin:8px 0 0;color:#4b5563;font-size:13px">Use this code at checkout for a special discount!</p>
</div>`
    : "";

  const content = `
<h2 style="margin:0 0 16px;color:#111827">Welcome to PixelCodes!</h2>
<p style="color:#4b5563;margin:0 0 20px">Your subscription has been confirmed. You'll now receive exclusive deals, new product alerts, and special discounts right in your inbox.</p>
${discountBlock}
<p style="color:#9ca3af;font-size:12px;margin:20px 0 0">
<a href="${esc(p.unsubUrl)}" style="color:#9ca3af">Unsubscribe</a>
</p>`;
  return { subject: "Welcome to PixelCodes Newsletter!", html: wrap(content) };
}
