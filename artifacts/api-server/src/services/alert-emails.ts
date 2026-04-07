interface PriceDropEmailParams {
  siteName: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  oldPrice: string;
  newPrice: string;
  savings: string;
  unsubscribeUrl: string;
}

interface BackInStockEmailParams {
  siteName: string;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  price: string;
  stockCount: number;
  unsubscribeUrl: string;
}

function layout(siteName: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
<div style="background:#2563eb;padding:20px 24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">${siteName}</h1></div>
<div style="padding:24px">${content}</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px">
${siteName} — Your trusted source for digital software keys
</div></div></div></body></html>`;
}

export function priceDropEmail(p: PriceDropEmailParams): { subject: string; html: string } {
  const img = p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.productName}" style="width:100px;height:100px;object-fit:contain;border-radius:8px">` : "";
  const content = `
<h2 style="margin:0 0 16px;color:#111827">Price Drop Alert!</h2>
<p style="color:#4b5563;margin:0 0 20px">Great news! A product on your watchlist just dropped in price.</p>
<div style="display:flex;align-items:center;gap:16px;padding:16px;background:#f0f9ff;border-radius:8px;margin:0 0 20px">
${img}
<div>
<h3 style="margin:0 0 8px;color:#111827">${p.productName}</h3>
<p style="margin:0"><span style="text-decoration:line-through;color:#9ca3af">$${p.oldPrice}</span> <span style="color:#16a34a;font-size:20px;font-weight:700">$${p.newPrice}</span></p>
<p style="margin:4px 0 0;color:#16a34a;font-size:14px">You save $${p.savings}!</p>
</div></div>
<div style="text-align:center;margin:24px 0">
<a href="${p.productUrl}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">View Product</a>
</div>
<p style="color:#9ca3af;font-size:12px;text-align:center;margin:20px 0 0">
<a href="${p.unsubscribeUrl}" style="color:#9ca3af">Unsubscribe from this alert</a>
</p>`;
  return { subject: `Price Drop: ${p.productName} now $${p.newPrice}!`, html: layout(p.siteName, content) };
}

export function backInStockEmail(p: BackInStockEmailParams): { subject: string; html: string } {
  const img = p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.productName}" style="width:100px;height:100px;object-fit:contain;border-radius:8px">` : "";
  const content = `
<h2 style="margin:0 0 16px;color:#111827">Back in Stock!</h2>
<p style="color:#4b5563;margin:0 0 20px">A product you were waiting for is now available again.</p>
<div style="display:flex;align-items:center;gap:16px;padding:16px;background:#f0fdf4;border-radius:8px;margin:0 0 20px">
${img}
<div>
<h3 style="margin:0 0 8px;color:#111827">${p.productName}</h3>
<p style="margin:0;color:#111827;font-size:18px;font-weight:700">$${p.price}</p>
<p style="margin:4px 0 0;color:#16a34a;font-size:14px">${p.stockCount} in stock — grab yours now!</p>
</div></div>
<div style="text-align:center;margin:24px 0">
<a href="${p.productUrl}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Buy Now</a>
</div>
<p style="color:#9ca3af;font-size:12px;text-align:center;margin:20px 0 0">
<a href="${p.unsubscribeUrl}" style="color:#9ca3af">Unsubscribe from this alert</a>
</p>`;
  return { subject: `Back in Stock: ${p.productName}`, html: layout(p.siteName, content) };
}
