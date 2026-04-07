import { Router } from "express";
import { db } from "@workspace/db";
import { checkoutServices } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/checkout-services", async (_req, res) => {
  const services = await db
    .select()
    .from(checkoutServices)
    .where(eq(checkoutServices.enabled, true))
    .orderBy(asc(checkoutServices.sortOrder));

  res.json({ services });
});

export default router;
