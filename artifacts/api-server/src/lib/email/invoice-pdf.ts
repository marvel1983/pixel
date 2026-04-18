import PDFDocument from "pdfkit";
import type { InvoiceData } from "./invoice-template";

const BLUE = "#1463F3";
const DARK = "#1a1a1a";
const MUTED = "#666666";
const LIGHT_BG = "#f7f8fa";
const BORDER = "#e0e0e0";

function fmt(amountUsd: number, currencyCode: string, rate: number): string {
  const amount = amountUsd * rate;
  const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  return `${symbols[currencyCode] ?? currencyCode + " "}${amount.toFixed(2)}`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { seller, buyer, items, currencyCode, currencyRate: rate } = data;
    const W = doc.page.width - 100; // usable width
    const LEFT = 50;
    const RIGHT = LEFT + W;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text(data.siteName, LEFT, 50);

    doc.font("Helvetica-Bold").fontSize(32).fillColor(BLUE).text("INVOICE", RIGHT - 130, 42, { width: 130, align: "right" });

    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    const metaX = RIGHT - 180;
    let metaY = 82;
    doc.text(`Invoice No:`, metaX, metaY, { continued: true }).fillColor(DARK).text(` INV-${data.invoiceNumber}`, { align: "left" });
    metaY += 14;
    doc.fillColor(MUTED).text(`Invoice Date:`, metaX, metaY, { continued: true }).fillColor(DARK).text(` ${data.invoiceDate}`);
    metaY += 14;
    doc.fillColor(MUTED).text(`Due Date:`, metaX, metaY, { continued: true }).fillColor(DARK).text(` ${data.invoiceDate}`);

    // ── Divider ──────────────────────────────────────────────────────────────
    let y = 120;
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 16;

    // ── Seller / Buyer ───────────────────────────────────────────────────────
    const colW = W / 2 - 10;
    const sellerLines = [
      seller.name,
      seller.country ? `Country: ${seller.country}` : null,
      seller.city ? `City: ${seller.city}` : null,
      seller.address ?? null,
      seller.taxId ? `Tax ID: ${seller.taxId}` : null,
      seller.email ? `Email: ${seller.email}` : null,
    ].filter(Boolean) as string[];

    const buyerLines = [
      `${buyer.firstName} ${buyer.lastName}`,
      buyer.country ? `Country: ${buyer.country}` : null,
      buyer.city ? `City: ${buyer.city}` : null,
      buyer.address ?? null,
      buyer.vatNumber ? `VAT: ${buyer.vatNumber}` : null,
      `Email: ${buyer.email}`,
    ].filter(Boolean) as string[];

    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("SELLER", LEFT, y);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("BUYER", LEFT + colW + 20, y);
    y += 12;

    const lineH = 13;
    sellerLines.forEach((line, i) => {
      const font = i === 0 ? "Helvetica-Bold" : "Helvetica";
      doc.font(font).fontSize(9).fillColor(DARK).text(line, LEFT, y + i * lineH, { width: colW });
    });
    buyerLines.forEach((line, i) => {
      const font = i === 0 ? "Helvetica-Bold" : "Helvetica";
      doc.font(font).fontSize(9).fillColor(DARK).text(line, LEFT + colW + 20, y + i * lineH, { width: colW });
    });

    y += Math.max(sellerLines.length, buyerLines.length) * lineH + 16;

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 14;

    // ── Items table header ───────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("DESCRIPTION", LEFT, y);
    y += 12;

    const colProduct = LEFT;
    const colQty = LEFT + W * 0.55;
    const colPrice = LEFT + W * 0.65;
    const colTax = LEFT + W * 0.76;
    const colTotal = LEFT + W * 0.87;

    // table header bg
    doc.rect(LEFT, y, W, 20).fill(LIGHT_BG);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    doc.text("PRODUCT", colProduct + 4, y + 6);
    doc.text("QTY", colQty, y + 6, { width: 40, align: "center" });
    doc.text("PRICE", colPrice, y + 6, { width: 50, align: "right" });
    doc.text("TAX", colTax, y + 6, { width: 40, align: "right" });
    doc.text("TOTAL", colTotal, y + 6, { width: RIGHT - colTotal, align: "right" });
    y += 22;

    // table rows
    for (const it of items) {
      const lineTotal = it.unitPriceUsd * it.quantity;
      const taxAmt = lineTotal * (data.taxRate / 100);
      const label = it.variant && it.variant !== it.name ? `${it.name} (${it.variant})` : it.name;

      doc.font("Helvetica").fontSize(9).fillColor(DARK);
      doc.text(label, colProduct + 4, y, { width: colQty - colProduct - 8 });
      doc.text(String(it.quantity), colQty, y, { width: 40, align: "center" });
      doc.text(fmt(it.unitPriceUsd, currencyCode, rate), colPrice, y, { width: 50, align: "right" });
      doc.text(`${data.taxRate.toFixed(2)}%`, colTax, y, { width: 40, align: "right" });
      doc.text(fmt(lineTotal + taxAmt, currencyCode, rate), colTotal, y, { width: RIGHT - colTotal, align: "right" });

      y += 16;
      doc.moveTo(LEFT, y - 2).lineTo(RIGHT, y - 2).strokeColor(BORDER).lineWidth(0.5).stroke();
    }

    y += 10;

    // ── Totals ───────────────────────────────────────────────────────────────
    const totX = RIGHT - 200;
    const totLabelW = 120;
    const totValW = 80;

    const totals: [string, string, boolean][] = [
      ["Items Subtotal", fmt(data.subtotalUsd, currencyCode, rate), false],
      ...(data.discountUsd > 0 ? [["Discount", `-${fmt(data.discountUsd, currencyCode, rate)}`, false] as [string, string, boolean]] : []),
      ["Tax Base", fmt(data.subtotalUsd - data.discountUsd, currencyCode, rate), false],
      [`VAT ${data.taxRate.toFixed(2)}%`, fmt(data.taxAmountUsd, currencyCode, rate), false],
      ["Total", fmt(data.totalUsd, currencyCode, rate), true],
    ];

    for (const [label, value, bold] of totals) {
      const f = bold ? "Helvetica-Bold" : "Helvetica";
      const sz = bold ? 10 : 9;
      doc.font(f).fontSize(sz).fillColor(DARK);
      doc.text(label, totX, y, { width: totLabelW });
      doc.text(value, totX + totLabelW, y, { width: totValW, align: "right" });
      y += bold ? 0 : 14;
      if (bold) {
        y += 4;
        doc.moveTo(totX, y).lineTo(RIGHT, y).strokeColor(BORDER).lineWidth(0.5).stroke();
        y += 8;
      }
    }

    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`All amounts in ${currencyCode}.`, totX, y, { width: totLabelW + totValW, align: "right" });
    y += 20;

    // ── Notes ────────────────────────────────────────────────────────────────
    const payLabel = data.paymentMethod === "CARD" ? "Card Payment"
      : data.paymentMethod === "WALLET" ? "Wallet Payment"
      : data.paymentMethod === "NET30" ? "Net 30 Invoice"
      : data.paymentMethod;

    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("ADDITIONAL NOTES", LEFT, y);
    y += 12;
    doc.rect(LEFT, y, W, 22).fill(LIGHT_BG);
    doc.font("Helvetica").fontSize(9).fillColor(DARK)
      .text(`Online Order — ${payLabel} (${data.invoiceNumber})`, LEFT + 6, y + 7);
    y += 30;

    // ── Tagline ──────────────────────────────────────────────────────────────
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(BLUE)
      .text("It's a pleasure doing business with you!", LEFT, y, { width: W, align: "center" });

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(`© ${new Date().getFullYear()} ${data.siteName} · Official Purchase Invoice`,
        LEFT, doc.page.height - 40, { width: W, align: "center" });

    doc.end();
  });
}
