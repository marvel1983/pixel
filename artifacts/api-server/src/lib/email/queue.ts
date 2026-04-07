import { db } from "@workspace/db";
import { emailQueue } from "@workspace/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { sendEmail } from "./mailer";
import { logger } from "../logger";

export async function enqueueEmail(
  to: string,
  subject: string,
  html: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(emailQueue).values({
    to,
    subject,
    html,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    metadata: metadata ?? {},
  });
  logger.info({ to, subject }, "Email enqueued");
}

export async function processEmailQueue(): Promise<{ processed: number; failed: number }> {
  const pending = await db
    .select()
    .from(emailQueue)
    .where(
      and(
        eq(emailQueue.status, "pending"),
        lt(emailQueue.attempts, emailQueue.maxAttempts),
      ),
    )
    .limit(10);

  if (pending.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const email of pending) {
    try {
      const sent = await sendEmail(email.to, email.subject, email.html);
      if (!sent) {
        await db
          .update(emailQueue)
          .set({ attempts: email.attempts + 1, lastError: "SMTP not configured" })
          .where(eq(emailQueue.id, email.id));
        failed++;
        continue;
      }
      await db
        .update(emailQueue)
        .set({
          status: "sent",
          processedAt: new Date(),
          attempts: email.attempts + 1,
        })
        .where(eq(emailQueue.id, email.id));
      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = email.attempts + 1;
      await db
        .update(emailQueue)
        .set({
          attempts: newAttempts,
          lastError: errorMsg,
          status: newAttempts >= email.maxAttempts ? "failed" : "pending",
        })
        .where(eq(emailQueue.id, email.id));
      failed++;
    }
  }

  return { processed, failed };
}
