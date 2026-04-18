export interface InvoiceItem {
  name: string;
  variant: string;
  quantity: number;
  unitPriceUsd: number;
}

export interface InvoiceSeller {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  taxId?: string | null;
  email?: string | null;
}

export interface InvoiceBuyer {
  firstName: string;
  lastName: string;
  email: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  items: InvoiceItem[];
  subtotalUsd: number;
  discountUsd: number;
  processingFeeUsd?: number;
  taxRate: number;
  taxAmountUsd: number;
  totalUsd: number;
  currencyCode: string;
  currencyRate: number;
  paymentMethod: string;
  siteName: string;
  logoUrl?: string | null;
}

function fmt(amountUsd: number, currencyCode: string, rate: number): string {
  const amount = amountUsd * rate;
  const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  const sym = symbols[currencyCode] ?? currencyCode + " ";
  return `${sym}${amount.toFixed(2)}`;
}

function row(label: string, value: string, bold = false): string {
  const weight = bold ? "font-weight:700;" : "";
  return `<tr>
    <td style="padding:3px 0;color:#555;font-size:13px;">${label}</td>
    <td style="padding:3px 0;text-align:right;font-size:13px;${weight}">${value}</td>
  </tr>`;
}

export function invoiceEmail(data: InvoiceData): { subject: string; html: string } {
  const { seller, buyer, items, currencyCode, currencyRate: rate } = data;

  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="${data.siteName}" style="max-height:48px;max-width:160px;">`
    : `<span style="font-size:22px;font-weight:700;color:#1a1a2e;">${data.siteName}</span>`;

  const itemRows = items.map((it) => {
    const lineTotal = it.unitPriceUsd * it.quantity;
    const taxAmt = lineTotal * (data.taxRate / 100);
    return `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px 8px;font-size:13px;">${it.name}${it.variant && it.variant !== it.name ? ` <span style="color:#888">(${it.variant})</span>` : ""}</td>
      <td style="padding:10px 8px;text-align:center;font-size:13px;">${it.quantity}</td>
      <td style="padding:10px 8px;text-align:right;font-size:13px;">${fmt(it.unitPriceUsd, currencyCode, rate)}</td>
      <td style="padding:10px 8px;text-align:right;font-size:13px;">${data.taxRate.toFixed(2)}%</td>
      <td style="padding:10px 8px;text-align:right;font-size:13px;">${fmt(lineTotal + taxAmt, currencyCode, rate)}</td>
    </tr>`;
  }).join("");

  const payMethodLabel = data.paymentMethod === "CARD" ? "Card Payment"
    : data.paymentMethod === "WALLET" ? "Wallet Payment"
    : data.paymentMethod === "NET30" ? "Net 30 Invoice"
    : data.paymentMethod;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:24px;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">
<table width="700" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr>
    <td style="padding:32px 40px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">${logoHtml}</td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:38px;font-weight:900;color:#1463F3;letter-spacing:-1px;">INVOICE</div>
            <div style="font-size:13px;color:#555;line-height:1.8;margin-top:4px;">
              <b>Invoice No:</b> INV-${data.invoiceNumber}<br>
              <b>Invoice Date:</b> ${data.invoiceDate}<br>
              <b>Due Date:</b> ${data.invoiceDate}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e0e0e0;margin:0;"></td></tr>

  <!-- Seller / Buyer -->
  <tr>
    <td style="padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:20px;">
            <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;">SELLER</div>
            <div style="font-size:13px;line-height:1.7;color:#333;">
              <b>${seller.name}</b><br>
              ${seller.country ? `Country: ${seller.country}<br>` : ""}
              ${seller.city ? `City: ${seller.city}<br>` : ""}
              ${seller.address ? `${seller.address}<br>` : ""}
              ${seller.taxId ? `Tax ID: ${seller.taxId}<br>` : ""}
              ${seller.email ? `Email: ${seller.email}` : ""}
            </div>
          </td>
          <td style="vertical-align:top;width:50%;padding-left:20px;border-left:1px solid #eee;">
            <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;">BUYER</div>
            <div style="font-size:13px;line-height:1.7;color:#333;">
              <b>${buyer.firstName} ${buyer.lastName}</b><br>
              ${buyer.country ? `Country: ${buyer.country}<br>` : ""}
              ${buyer.city ? `City: ${buyer.city}<br>` : ""}
              ${buyer.address ? `${buyer.address}<br>` : ""}
              ${buyer.vatNumber ? `VAT: ${buyer.vatNumber}<br>` : ""}
              Email: ${buyer.email}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e0e0e0;margin:0;"></td></tr>

  <!-- Items table -->
  <tr>
    <td style="padding:24px 40px 0;">
      <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:12px;">DESCRIPTION</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background:#f7f8fa;">
          <th style="padding:10px 8px;text-align:left;font-size:12px;color:#555;border-bottom:2px solid #e0e0e0;">PRODUCT</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;color:#555;border-bottom:2px solid #e0e0e0;">QTY</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#555;border-bottom:2px solid #e0e0e0;">PRICE</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#555;border-bottom:2px solid #e0e0e0;">TAX</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;color:#555;border-bottom:2px solid #e0e0e0;">TOTAL</th>
        </tr>
        ${itemRows}
      </table>
    </td>
  </tr>

  <!-- Totals -->
  <tr>
    <td style="padding:16px 40px 24px;">
      <table width="280" cellpadding="0" cellspacing="0" style="margin-left:auto;">
        ${row("Items Subtotal", fmt(data.subtotalUsd, currencyCode, rate))}
        ${data.discountUsd > 0 ? row("Discount", `-${fmt(data.discountUsd, currencyCode, rate)}`) : ""}
        ${(data.processingFeeUsd ?? 0) > 0.005 ? row("Processing fee", `+${fmt(data.processingFeeUsd!, currencyCode, rate)}`) : ""}
        ${row("Tax Base", fmt(data.subtotalUsd - data.discountUsd, currencyCode, rate))}
        ${row(`VAT ${data.taxRate.toFixed(2)}%`, fmt(data.taxAmountUsd, currencyCode, rate))}
        <tr><td colspan="2"><hr style="border:none;border-top:1px solid #ccc;margin:6px 0;"></td></tr>
        ${row("<b>Total</b>", `<b>${fmt(data.totalUsd, currencyCode, rate)}</b>`, true)}
        <tr><td colspan="2" style="font-size:11px;color:#888;text-align:right;padding-top:4px;">All amounts in ${currencyCode}.</td></tr>
      </table>
    </td>
  </tr>

  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e0e0e0;margin:0;"></td></tr>

  <!-- Notes -->
  <tr>
    <td style="padding:20px 40px;">
      <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:8px;">ADDITIONAL NOTES</div>
      <div style="font-size:13px;color:#555;background:#f7f8fa;padding:10px 14px;border-radius:4px;">
        Online Order — ${payMethodLabel} (${data.invoiceNumber})
      </div>
    </td>
  </tr>

  <!-- Tagline -->
  <tr>
    <td style="padding:0 40px 32px;text-align:center;">
      <em style="color:#1463F3;font-size:14px;">It's a pleasure doing business with you!</em>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f7f8fa;padding:16px 40px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;">
      © ${new Date().getFullYear()} ${data.siteName} · This is your official purchase invoice
    </td>
  </tr>

</table>
</body></html>`;

  return {
    subject: `Invoice INV-${data.invoiceNumber} — ${data.siteName}`,
    html,
  };
}
