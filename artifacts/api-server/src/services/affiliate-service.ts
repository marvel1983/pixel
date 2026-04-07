import { db } from "@workspace/db";
import {
  affiliateProfiles,
  affiliateCommissions,
  affiliateSettings,
} from "@workspace/db/schema";
import { eq, and, sql, lte } from "drizzle-orm";
import { logger } from "../lib/logger";

export async function createCommissionForOrder(
  affiliateRefCode: string,
  orderId: number,
  orderTotal: number,
): Promise<void> {
  const [settings] = await db.select().from(affiliateSettings);
  if (!settings?.enabled) return;

  const [affiliate] = await db.select().from(affiliateProfiles)
    .where(and(
      eq(affiliateProfiles.referralCode, affiliateRefCode),
      eq(affiliateProfiles.status, "APPROVED"),
    ));
  if (!affiliate) return;

  const rate = parseFloat(affiliate.commissionRate);
  const amount = Math.round(orderTotal * (rate / 100) * 100) / 100;
  if (amount <= 0) return;

  const holdDays = settings.holdPeriodDays || 14;
  const heldUntil = new Date();
  heldUntil.setDate(heldUntil.getDate() + holdDays);

  await db.insert(affiliateCommissions).values({
    affiliateId: affiliate.id,
    orderId,
    orderTotal: orderTotal.toFixed(2),
    commissionRate: rate.toFixed(2),
    commissionAmount: amount.toFixed(2),
    status: "HELD",
    heldUntil,
  });

  await db.update(affiliateProfiles).set({
    totalOrders: sql`${affiliateProfiles.totalOrders} + 1`,
    pendingBalance: sql`${affiliateProfiles.pendingBalance} + ${amount.toFixed(2)}::numeric`,
    updatedAt: new Date(),
  }).where(eq(affiliateProfiles.id, affiliate.id));

  logger.info({ affiliateId: affiliate.id, orderId, amount }, "Affiliate commission created");
}

export async function reverseCommissionsForOrder(orderId: number): Promise<void> {
  const commissions = await db.select().from(affiliateCommissions)
    .where(and(
      eq(affiliateCommissions.orderId, orderId),
      sql`${affiliateCommissions.status} != 'REVERSED'`,
    ));

  for (const comm of commissions) {
    const amount = parseFloat(comm.commissionAmount);
    const wasPaid = comm.status === "PAID";

    await db.update(affiliateCommissions).set({
      status: "REVERSED",
      reversedAt: new Date(),
      reversalReason: "Order refunded",
    }).where(eq(affiliateCommissions.id, comm.id));

    const balanceField = wasPaid ? affiliateProfiles.totalPaid : affiliateProfiles.pendingBalance;
    await db.update(affiliateProfiles).set({
      [wasPaid ? "totalPaid" : "pendingBalance"]: sql`${balanceField} - ${amount.toFixed(2)}::numeric`,
      totalEarned: sql`${affiliateProfiles.totalEarned} - ${amount.toFixed(2)}::numeric`,
      updatedAt: new Date(),
    }).where(eq(affiliateProfiles.id, comm.affiliateId));

    logger.info({ commissionId: comm.id, orderId, amount }, "Commission reversed");
  }
}

export async function approveHeldCommissions(): Promise<number> {
  const now = new Date();
  const held = await db.select().from(affiliateCommissions)
    .where(and(
      eq(affiliateCommissions.status, "HELD"),
      lte(affiliateCommissions.heldUntil, now),
    ));

  let count = 0;
  for (const comm of held) {
    const amount = parseFloat(comm.commissionAmount);
    await db.update(affiliateCommissions).set({
      status: "APPROVED",
      approvedAt: now,
    }).where(eq(affiliateCommissions.id, comm.id));

    await db.update(affiliateProfiles).set({
      pendingBalance: sql`${affiliateProfiles.pendingBalance} - ${amount.toFixed(2)}::numeric`,
      totalEarned: sql`${affiliateProfiles.totalEarned} + ${amount.toFixed(2)}::numeric`,
      updatedAt: now,
    }).where(eq(affiliateProfiles.id, comm.affiliateId));
    count++;
  }

  if (count > 0) logger.info({ count }, "Approved held commissions");
  return count;
}
