import { Router } from "express";
import { db } from "@workspace/db";
import { checkoutServices } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/checkout-services", ...auth, async (_req, res) => {
  const services = await db
    .select()
    .from(checkoutServices)
    .orderBy(asc(checkoutServices.sortOrder));
  res.json({ services });
});

router.post("/admin/checkout-services", ...auth, async (req, res) => {
  const { name, description, shortDescription, priceUsd, icon, enabled, sortOrder } = req.body;
  if (!name || !description || !shortDescription || priceUsd === undefined) {
    res.status(400).json({ error: "name, description, shortDescription, and priceUsd are required" });
    return;
  }
  const price = parseFloat(priceUsd);
  if (!Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Price must be a non-negative number" });
    return;
  }
  const [service] = await db
    .insert(checkoutServices)
    .values({
      name,
      description,
      shortDescription,
      priceUsd: price.toFixed(2),
      icon: icon || "shield",
      enabled: enabled ?? true,
      sortOrder: sortOrder ?? 0,
    })
    .returning();
  res.status(201).json({ service });
});

router.put("/admin/checkout-services/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(checkoutServices).where(eq(checkoutServices.id, id));
  if (!existing) { res.status(404).json({ error: "Service not found" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.shortDescription !== undefined) updates.shortDescription = req.body.shortDescription;
  if (req.body.priceUsd !== undefined) {
    const price = parseFloat(req.body.priceUsd);
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ error: "Invalid price" }); return;
    }
    updates.priceUsd = price.toFixed(2);
  }
  if (req.body.icon !== undefined) updates.icon = req.body.icon;
  if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
  if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;

  const [updated] = await db
    .update(checkoutServices)
    .set(updates)
    .where(eq(checkoutServices.id, id))
    .returning();
  res.json({ service: updated });
});

router.delete("/admin/checkout-services/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(checkoutServices).where(eq(checkoutServices.id, id));
  if (!existing) { res.status(404).json({ error: "Service not found" }); return; }
  await db.delete(checkoutServices).where(eq(checkoutServices.id, id));
  res.json({ success: true });
});

router.post("/admin/checkout-services/reorder", ...auth, async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) { res.status(400).json({ error: "order array required" }); return; }
  for (let i = 0; i < order.length; i++) {
    await db
      .update(checkoutServices)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(eq(checkoutServices.id, order[i]));
  }
  res.json({ success: true });
});

router.post("/admin/checkout-services/seed", ...auth, async (_req, res) => {
  const defaults = [
    { name: "Fastest Delivery", shortDescription: "Get your keys instantly", description: "Skip the queue and receive your product keys within seconds. Priority processing ensures the fastest possible delivery.", priceUsd: "0.49", icon: "zap", sortOrder: 0 },
    { name: "Purchase Protection Plus", shortDescription: "Enhanced buyer protection", description: "Extended protection against invalid keys, failed activations, and unauthorized transactions. Full refund guarantee within 30 days.", priceUsd: "0.99", icon: "shield-check", sortOrder: 1 },
    { name: "Extended Warranty", shortDescription: "12-month key replacement", description: "If your key stops working within 12 months of purchase, we'll replace it free of charge. Peace of mind for your digital purchases.", priceUsd: "1.49", icon: "clock", sortOrder: 2 },
    { name: "Priority Support", shortDescription: "24/7 dedicated support", description: "Jump to the front of the support queue with priority access to our dedicated support team. Average response time under 15 minutes.", priceUsd: "0.79", icon: "headphones", sortOrder: 3 },
  ];
  const existing = await db.select().from(checkoutServices);
  if (existing.length > 0) {
    res.json({ message: "Services already seeded", count: existing.length });
    return;
  }
  const inserted = await db.insert(checkoutServices).values(defaults).returning();
  res.json({ message: "Seeded default services", count: inserted.length });
});

export default router;
