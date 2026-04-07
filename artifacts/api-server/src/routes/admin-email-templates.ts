import { Router } from "express";
import { db } from "@workspace/db";
import { emailTemplates } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

const DEFAULT_TEMPLATES = [
  { key: "order_confirmation", name: "Order Confirmation", subject: "Your order #{{orderId}} has been confirmed", bodyHtml: "<h1>Thank you for your order!</h1><p>Hi {{customerName}},</p><p>Your order <strong>#{{orderId}}</strong> has been confirmed and is being processed.</p><p>Total: {{orderTotal}}</p>", variables: ["orderId", "customerName", "orderTotal", "orderDate", "items"], sampleData: { orderId: "10042", customerName: "John Doe", orderTotal: "$49.99", orderDate: "2026-01-15", items: "Windows 11 Pro x1" } },
  { key: "key_delivery", name: "Key Delivery", subject: "Your license key for order #{{orderId}}", bodyHtml: "<h1>Your License Key</h1><p>Hi {{customerName}},</p><p>Here is your license key for <strong>{{productName}}</strong>:</p><pre>{{licenseKey}}</pre><p>Please save this key in a secure location.</p>", variables: ["orderId", "customerName", "productName", "licenseKey"], sampleData: { orderId: "10042", customerName: "John Doe", productName: "Windows 11 Pro", licenseKey: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" } },
  { key: "welcome", name: "Welcome Email", subject: "Welcome to PixelCodes, {{customerName}}!", bodyHtml: "<h1>Welcome to PixelCodes!</h1><p>Hi {{customerName}},</p><p>Thank you for creating an account. Browse our store for the best deals on software licenses.</p>", variables: ["customerName", "email"], sampleData: { customerName: "John Doe", email: "john@example.com" } },
  { key: "password_reset", name: "Password Reset", subject: "Reset your PixelCodes password", bodyHtml: "<h1>Password Reset</h1><p>Hi {{customerName}},</p><p>Click the link below to reset your password:</p><p><a href='{{resetLink}}'>Reset Password</a></p><p>This link expires in {{expiresIn}}.</p>", variables: ["customerName", "resetLink", "expiresIn"], sampleData: { customerName: "John Doe", resetLink: "https://pixelcodes.com/reset/abc123", expiresIn: "1 hour" } },
  { key: "order_cancelled", name: "Order Cancelled", subject: "Your order #{{orderId}} has been cancelled", bodyHtml: "<h1>Order Cancelled</h1><p>Hi {{customerName}},</p><p>Your order <strong>#{{orderId}}</strong> has been cancelled.</p><p>If you were charged, a refund of {{refundAmount}} will be processed shortly.</p>", variables: ["orderId", "customerName", "refundAmount", "reason"], sampleData: { orderId: "10042", customerName: "John Doe", refundAmount: "$49.99", reason: "Requested by customer" } },
  { key: "claim_resolved", name: "Claim Resolved", subject: "Your claim #{{claimId}} has been resolved", bodyHtml: "<h1>Claim Resolved</h1><p>Hi {{customerName}},</p><p>Your claim <strong>#{{claimId}}</strong> for order #{{orderId}} has been resolved.</p><p>Resolution: {{resolution}}</p>", variables: ["claimId", "orderId", "customerName", "resolution"], sampleData: { claimId: "CLM-001", orderId: "10042", customerName: "John Doe", resolution: "Replacement key issued" } },
];

router.get("/admin/email-templates", requireAuth, requireAdmin, async (_req, res) => {
  let templates = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.id));
  if (templates.length === 0) {
    await db.insert(emailTemplates).values(DEFAULT_TEMPLATES);
    templates = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.id));
  }
  res.json({ templates });
});

router.get("/admin/email-templates/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [tmpl] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  if (!tmpl) { res.status(404).json({ error: "Template not found" }); return; }
  res.json({ template: tmpl });
});

router.put("/admin/email-templates/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { subject, bodyHtml, isEnabled, name, variables, sampleData } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof subject === "string") updates.subject = subject;
  if (typeof bodyHtml === "string") updates.bodyHtml = bodyHtml;
  if (typeof name === "string") updates.name = name;
  if (typeof isEnabled === "boolean") updates.isEnabled = isEnabled;
  if (Array.isArray(variables)) updates.variables = variables;
  if (sampleData && typeof sampleData === "object") updates.sampleData = sampleData;
  await db.update(emailTemplates).set(updates).where(eq(emailTemplates.id, id));
  const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  res.json({ template: updated });
});

router.post("/admin/email-templates/:id/test", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { email } = req.body;
  if (!email || typeof email !== "string") { res.status(400).json({ error: "email is required" }); return; }
  const [tmpl] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
  if (!tmpl) { res.status(404).json({ error: "Template not found" }); return; }
  res.json({ success: true, message: `Test email queued for ${email}` });
});

export default router;
