/**
 * Invoice PDF generation.
 *
 * Primary: puppeteer renders HTML email template (identical to customer email).
 * Fallback: pdfkit with full professional design + logo.
 */

import puppeteer from "puppeteer";
import PDFDocument from "pdfkit";
import { invoiceEmail } from "./invoice-template";
import type { InvoiceData } from "./invoice-template";
import { logger } from "../logger";

// ── Puppeteer (primary) ───────────────────────────────────────────────────────

async function generateViaPuppeteer(data: InvoiceData): Promise<Buffer> {
  const { html } = invoiceEmail(data);
  const wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page{margin:0;size:A4}
  body{margin:0;padding:0;background:#f0f2f5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>${html}</body></html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
           "--disable-accelerated-2d-canvas","--no-first-run","--no-zygote",
           "--single-process","--disable-gpu"],
  });
  try {
    const tab = await browser.newPage();
    await tab.setContent(wrapped, { waitUntil: "networkidle0", timeout: 15_000 });
    const pdf = await tab.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── pdfkit fallback ───────────────────────────────────────────────────────────

const SLATE  = "#374151";
const DARK   = "#111827";
const MUTED  = "#6B7280";
const LIGHT  = "#F3F4F6";
const LIGHT2 = "#F9FAFB";
const BORDER = "#D1D5DB";
const WHITE  = "#FFFFFF";

function money(amount: number, code: string, rate: number): string {
  const v = amount * rate;
  const s: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", PLN: "zł", CAD: "C$", AUD: "A$", BRL: "R$", TRY: "₺" };
  if (code === "HUF" || code === "CZK") return `${Math.round(v)} ${code}`;
  return `${s[code] ?? (code + " ")}${v.toFixed(2)}`;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function generateViaPdfkit(data: InvoiceData): Promise<Buffer> {
  // Pre-fetch logo so we can embed it
  let logoBuffer: Buffer | null = null;
  if (data.logoUrl) {
    logoBuffer = await fetchImageBuffer(data.logoUrl);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 841
    const PAD = 48;
    const W = PW - PAD * 2;

    // ── Top bar ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, PW, 80).fill(SLATE);

    // Logo or site name in white
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, PAD, 18, { height: 44, fit: [160, 44] });
      } catch {
        doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE).text(data.siteName, PAD, 28);
      }
    } else {
      doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE).text(data.siteName, PAD, 28);
    }

    // INVOICE label
    doc.font("Helvetica-Bold").fontSize(26).fillColor(WHITE)
       .text("INVOICE", 0, 24, { width: PW - PAD, align: "right" });

    // ── Invoice meta strip (light grey) ──────────────────────────────────────
    doc.rect(0, 80, PW, 56).fill(LIGHT);
    const metaItems = [
      ["Invoice No", `INV-${data.invoiceNumber}`],
      ["Date", data.invoiceDate],
      ["Due", data.invoiceDate],
    ];
    const colW = W / 3;
    metaItems.forEach(([label, value], i) => {
      const x = PAD + i * colW;
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, 92);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(value, x, 104);
    });

    // ── Seller / Buyer ───────────────────────────────────────────────────────
    let y = 160;
    const half = W / 2 - 16;

    // section labels
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
       .text("SOLD BY", PAD, y).text("BILL TO", PAD + half + 32, y);
    y += 14;

    const { seller: s, buyer: b } = data;
    const sellerLines = [s.name, s.address, s.city ? `${s.city}${s.country ? ", " + s.country : ""}` : (s.country ?? null), s.taxId ? `Tax ID: ${s.taxId}` : null, s.email ? `Email: ${s.email}` : null].filter((x): x is string => !!x);
    const buyerLines = [`${b.firstName} ${b.lastName}`, b.address, b.city ? `${b.city}${b.country ? ", " + b.country : ""}` : (b.country ?? null), b.vatNumber ? `VAT: ${b.vatNumber}` : null, `Email: ${b.email}`].filter((x): x is string => !!x);

    const maxLines = Math.max(sellerLines.length, buyerLines.length);
    sellerLines.forEach((ln, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(DARK).text(ln, PAD, y + i * 14, { width: half });
    });
    buyerLines.forEach((ln, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(DARK).text(ln, PAD + half + 32, y + i * 14, { width: half });
    });
    y += maxLines * 14 + 24;

    // ── Items table ──────────────────────────────────────────────────────────
    // Table header
    doc.rect(PAD, y, W, 24).fill(SLATE);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE);
    const cProd = PAD + 8, cQty = PAD + W * 0.55, cPrice = PAD + W * 0.67, cTax = PAD + W * 0.79, cTotal = PAD + W * 0.88;
    doc.text("PRODUCT", cProd, y + 8);
    doc.text("QTY",   cQty,   y + 8, { width: 40, align: "center" });
    doc.text("PRICE", cPrice, y + 8, { width: 55, align: "right" });
    doc.text("TAX",   cTax,   y + 8, { width: 40, align: "right" });
    doc.text("TOTAL", cTotal, y + 8, { width: PW - PAD - cTotal, align: "right" });
    y += 24;

    const { currencyCode: cc, currencyRate: rate } = data;
    data.items.forEach((it, idx) => {
      const bg = idx % 2 === 0 ? WHITE : LIGHT2;
      doc.rect(PAD, y, W, 22).fill(bg);
      const lineTotal = it.unitPriceUsd * it.quantity;
      const taxAmt = lineTotal * (data.taxRate / 100);
      const label = it.variant && it.variant !== it.name ? `${it.name} (${it.variant})` : it.name;
      doc.font("Helvetica").fontSize(9).fillColor(DARK);
      doc.text(label, cProd, y + 6, { width: cQty - cProd - 8 });
      doc.text(String(it.quantity), cQty, y + 6, { width: 40, align: "center" });
      doc.text(money(it.unitPriceUsd, cc, rate), cPrice, y + 6, { width: 55, align: "right" });
      doc.text(`${data.taxRate.toFixed(1)}%`, cTax, y + 6, { width: 40, align: "right" });
      doc.text(money(lineTotal + taxAmt, cc, rate), cTotal, y + 6, { width: PW - PAD - cTotal, align: "right" });
      y += 22;
    });

    // thin border under table
    doc.rect(PAD, y, W, 1).fill(BORDER);
    y += 20;

    // ── Totals box ───────────────────────────────────────────────────────────
    type Row = [string, string, boolean, string?];
    const totals: Row[] = [
      ["Items Subtotal", money(data.subtotalUsd, cc, rate), false],
      ...(data.discountUsd > 0 ? [["Discount", `-${money(data.discountUsd, cc, rate)}`, false] as Row] : []),
      ...((data.processingFeeUsd ?? 0) > 0.005 ? [["Processing fee", `+${money(data.processingFeeUsd!, cc, rate)}`, false, MUTED] as Row] : []),
      ["Tax Base", money(data.subtotalUsd - data.discountUsd, cc, rate), false],
      [`VAT ${data.taxRate.toFixed(2)}%`, money(data.taxAmountUsd, cc, rate), false],
    ];

    const boxX = PAD + W * 0.5;
    const boxW = W * 0.5;

    totals.forEach(([label, value, , color]) => {
      doc.font("Helvetica").fontSize(9).fillColor(color ?? MUTED).text(label, boxX, y, { width: boxW * 0.6 });
      doc.font("Helvetica").fontSize(9).fillColor(color ?? DARK).text(value, boxX + boxW * 0.6, y, { width: boxW * 0.4, align: "right" });
      y += 16;
    });

    // Total row with dark grey background
    y += 4;
    doc.rect(boxX - 8, y - 4, boxW + 8, 28).fill(SLATE);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(WHITE).text("TOTAL", boxX, y + 4, { width: boxW * 0.6 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(WHITE).text(money(data.totalUsd, cc, rate), boxX + boxW * 0.6, y + 4, { width: boxW * 0.4, align: "right" });
    y += 36;

    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
       .text(`All amounts in ${cc}.`, boxX, y, { width: boxW, align: "right" });
    y += 20;

    // ── Notes ────────────────────────────────────────────────────────────────
    const payLabel = ({ CARD: "Card Payment", WALLET: "Wallet Payment", NET30: "Net 30 Invoice" } as Record<string, string>)[data.paymentMethod] ?? data.paymentMethod;
    doc.rect(PAD, y, W, 28).fill(LIGHT2);
    doc.rect(PAD, y, 4, 28).fill(SLATE);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("NOTE", PAD + 12, y + 5);
    doc.font("Helvetica").fontSize(9).fillColor(DARK).text(`Online Order — ${payLabel} (${data.invoiceNumber})`, PAD + 12, y + 15);
    y += 42;

    // ── Tagline ──────────────────────────────────────────────────────────────
    doc.font("Helvetica-Oblique").fontSize(11).fillColor(MUTED)
       .text("It's a pleasure doing business with you!", PAD, y, { width: W, align: "center" });

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.rect(0, PH - 40, PW, 40).fill(SLATE);
    doc.font("Helvetica").fontSize(8).fillColor(WHITE)
       .text(`© ${new Date().getFullYear()} ${data.siteName} · Official Purchase Invoice`, PAD, PH - 24, { width: W, align: "center" });

    doc.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  try {
    return await generateViaPuppeteer(data);
  } catch (err) {
    logger.warn({ err }, "Puppeteer unavailable — using pdfkit renderer");
    return generateViaPdfkit(data);
  }
}
