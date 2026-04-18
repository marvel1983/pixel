/**
 * Generates an invoice PDF by rendering the HTML email template
 * with a headless browser (puppeteer). Output is visually identical
 * to the email sent to the customer.
 */

import puppeteer from "puppeteer";
import { invoiceEmail } from "./invoice-template";
import type { InvoiceData } from "./invoice-template";

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const { html } = invoiceEmail(data);

  // Wrap the email HTML in a print-ready page with white background
  const page = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: A4; }
  body { margin: 0; padding: 0; background: #f0f2f5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head>
<body>${html}</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const tab = await browser.newPage();
    await tab.setContent(page, { waitUntil: "networkidle0" });
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
