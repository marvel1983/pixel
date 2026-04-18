/**
 * Invoice PDF generation.
 *
 * Primary path: puppeteer renders the HTML email template (identical to the
 *   customer email — logo, colours, full layout).
 * Fallback path: pdfkit-based layout used if Chrome cannot launch on this host.
 */

import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
import { invoiceEmail } from "./invoice-template";
import type { InvoiceData } from "./invoice-template";
import { logger } from "../logger";

// ── Puppeteer (primary) ───────────────────────────────────────────────────────

async function generateViaPuppeteer(data: InvoiceData): Promise<Buffer> {
  const { html } = invoiceEmail(data);

  const page = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  @page { margin: 0; size: A4; }
  body { margin: 0; padding: 0; background: #f0f2f5;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>${html}</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });

  try {
    const tab = await browser.newPage();
    await tab.setContent(page, { waitUntil: "networkidle0", timeout: 15_000 });
    const pdf = await tab.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── pdfkit fallback ───────────────────────────────────────────────────────────

const BLUE  = "#1463F3";
const DARK  = "#1a1a1a";
const MUTED = "#666666";
const LIGHT = "#f7f8fa";
const BORDER = "#e0e0e0";
const ORANGE = "#ea580c";

function fmt(amount: number, code: string, rate: number): string {
  const val = amount * rate;
  const sym: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  const s = sym[code] ?? (code + " ");
  if (code === "HUF" || code === "CZK") return `${Math.round(val)} ${s.trim()}`;
  return `${s}${val.toFixed(2)}`;
}

async function generateViaPdfkit(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { seller, buyer, items, currencyCode: cc, currencyRate: rate } = data;
    const W = doc.page.width - 100;
    const L = 50;
    const R = L + W;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text(data.siteName, L, 50);
    doc.font("Helvetica-Bold").fontSize(32).fillColor(BLUE).text("INVOICE", R - 130, 42, { width: 130, align: "right" });

    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    let mY = 82;
    const mX = R - 180;
    doc.text("Invoice No:", mX, mY, { continued: true }).fillColor(DARK).text(` INV-${data.invoiceNumber}`);
    mY += 14;
    doc.fillColor(MUTED).text("Invoice Date:", mX, mY, { continued: true }).fillColor(DARK).text(` ${data.invoiceDate}`);
    mY += 14;
    doc.fillColor(MUTED).text("Due Date:", mX, mY, { continued: true }).fillColor(DARK).text(` ${data.invoiceDate}`);

    // ── Divider ──────────────────────────────────────────────────────────────
    let y = 120;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 16;

    // ── Seller / Buyer ───────────────────────────────────────────────────────
    const half = W / 2 - 10;
    const sellerLines = [seller.name, seller.country ? `Country: ${seller.country}` : null, seller.city ? `City: ${seller.city}` : null, seller.address ?? null, seller.taxId ? `Tax ID: ${seller.taxId}` : null, seller.email ? `Email: ${seller.email}` : null].filter(Boolean) as string[];
    const buyerLines = [`${buyer.firstName} ${buyer.lastName}`, buyer.country ? `Country: ${buyer.country}` : null, buyer.city ? `City: ${buyer.city}` : null, buyer.address ?? null, buyer.vatNumber ? `VAT: ${buyer.vatNumber}` : null, `Email: ${buyer.email}`].filter(Boolean) as string[];

    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("SELLER", L, y);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("BUYER", L + half + 20, y);
    y += 12;
    const lh = 13;
    sellerLines.forEach((ln, i) => { doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(DARK).text(ln, L, y + i * lh, { width: half }); });
    buyerLines.forEach((ln, i) => { doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(DARK).text(ln, L + half + 20, y + i * lh, { width: half }); });
    y += Math.max(sellerLines.length, buyerLines.length) * lh + 16;

    doc.moveTo(L, y).lineTo(R, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 14;

    // ── Items table ──────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("DESCRIPTION", L, y);
    y += 12;
    const cQ = L + W * 0.55, cP = L + W * 0.65, cTx = L + W * 0.76, cTot = L + W * 0.87;
    doc.rect(L, y, W, 20).fill(LIGHT);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    doc.text("PRODUCT", L + 4, y + 6);
    doc.text("QTY", cQ, y + 6, { width: 40, align: "center" });
    doc.text("PRICE", cP, y + 6, { width: 50, align: "right" });
    doc.text("TAX", cTx, y + 6, { width: 40, align: "right" });
    doc.text("TOTAL", cTot, y + 6, { width: R - cTot, align: "right" });
    y += 22;

    for (const it of items) {
      const lineTotal = it.unitPriceUsd * it.quantity;
      const taxAmt = lineTotal * (data.taxRate / 100);
      const label = it.variant && it.variant !== it.name ? `${it.name} (${it.variant})` : it.name;
      doc.font("Helvetica").fontSize(9).fillColor(DARK);
      doc.text(label, L + 4, y, { width: cQ - L - 8 });
      doc.text(String(it.quantity), cQ, y, { width: 40, align: "center" });
      doc.text(fmt(it.unitPriceUsd, cc, rate), cP, y, { width: 50, align: "right" });
      doc.text(`${data.taxRate.toFixed(2)}%`, cTx, y, { width: 40, align: "right" });
      doc.text(fmt(lineTotal + taxAmt, cc, rate), cTot, y, { width: R - cTot, align: "right" });
      y += 16;
      doc.moveTo(L, y - 2).lineTo(R, y - 2).strokeColor(BORDER).lineWidth(0.5).stroke();
    }
    y += 10;

    // ── Totals ───────────────────────────────────────────────────────────────
    const tX = R - 200, lblW = 120, valW = 80;
    type TotalRow = [string, string, boolean, boolean?];
    const totals: TotalRow[] = [
      ["Items Subtotal", fmt(data.subtotalUsd, cc, rate), false],
      ...(data.discountUsd > 0 ? [["Discount", `-${fmt(data.discountUsd, cc, rate)}`, false] as TotalRow] : []),
      ...((data.processingFeeUsd ?? 0) > 0.005 ? [["Processing fee", `+${fmt(data.processingFeeUsd!, cc, rate)}`, false, true] as TotalRow] : []),
      ["Tax Base", fmt(data.subtotalUsd - data.discountUsd, cc, rate), false],
      [`VAT ${data.taxRate.toFixed(2)}%`, fmt(data.taxAmountUsd, cc, rate), false],
      ["Total", fmt(data.totalUsd, cc, rate), true],
    ];

    for (const [label, value, bold, orange] of totals) {
      const f = bold ? "Helvetica-Bold" : "Helvetica";
      const color = orange ? ORANGE : DARK;
      doc.font(f).fontSize(bold ? 10 : 9).fillColor(color);
      doc.text(label, tX, y, { width: lblW });
      doc.text(value, tX + lblW, y, { width: valW, align: "right" });
      y += bold ? 0 : 14;
      if (bold) {
        y += 4;
        doc.moveTo(tX, y).lineTo(R, y).strokeColor(BORDER).lineWidth(0.5).stroke();
        y += 8;
      }
    }
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`All amounts in ${cc}.`, tX, y, { width: lblW + valW, align: "right" });
    y += 20;

    // ── Notes ────────────────────────────────────────────────────────────────
    const payLabel = data.paymentMethod === "CARD" ? "Card Payment" : data.paymentMethod === "WALLET" ? "Wallet Payment" : data.paymentMethod === "NET30" ? "Net 30 Invoice" : data.paymentMethod;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("ADDITIONAL NOTES", L, y);
    y += 12;
    doc.rect(L, y, W, 22).fill(LIGHT);
    doc.font("Helvetica").fontSize(9).fillColor(DARK).text(`Online Order — ${payLabel} (${data.invoiceNumber})`, L + 6, y + 7);
    y += 30;

    doc.font("Helvetica-Oblique").fontSize(10).fillColor(BLUE).text("It's a pleasure doing business with you!", L, y, { width: W, align: "center" });

    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`© ${new Date().getFullYear()} ${data.siteName} · Official Purchase Invoice`, L, doc.page.height - 40, { width: W, align: "center" });

    doc.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  try {
    return await generateViaPuppeteer(data);
  } catch (err) {
    logger.warn({ err }, "Puppeteer PDF failed — falling back to pdfkit");
    return generateViaPdfkit(data);
  }
}
