interface QAAnsweredParams {
  askerName: string;
  productName: string;
  questionText: string;
  answerText: string;
  productUrl: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function qaAnsweredEmail(p: QAAnsweredParams): { subject: string; html: string } {
  const content = `
<h2 style="margin:0 0 16px;color:#111827">Your Question Was Answered!</h2>
<p style="color:#4b5563;margin:0 0 20px">Hi ${esc(p.askerName)}, your question about <strong>${esc(p.productName)}</strong> has been answered by our team.</p>
<div style="padding:16px;background:#f0f9ff;border-radius:8px;margin:0 0 16px">
<p style="margin:0 0 8px;font-weight:600;color:#111827">Your Question:</p>
<p style="margin:0;color:#4b5563">${esc(p.questionText)}</p>
</div>
<div style="padding:16px;background:#f0fdf4;border-radius:8px;margin:0 0 20px">
<p style="margin:0 0 8px;font-weight:600;color:#111827">Answer from Store Admin:</p>
<p style="margin:0;color:#4b5563">${esc(p.answerText)}</p>
</div>
<div style="text-align:center;margin:24px 0">
<a href="${p.productUrl}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">View Product</a>
</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<div style="background:#2563eb;padding:20px 24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">PixelCodes</h1></div>
<div style="padding:24px">${content}</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px">
PixelCodes — Your trusted source for digital software keys
</div></div></div></body></html>`;

  return { subject: `Your question about ${p.productName} was answered`, html };
}
