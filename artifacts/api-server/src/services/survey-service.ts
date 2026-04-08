import { db } from "@workspace/db";
import {
  surveyResponses, surveySettings, orders, supportTickets,
  ticketMessages, ticketStatusHistory,
} from "@workspace/db/schema";
import { eq, and, isNull, sql, lte, desc, count } from "drizzle-orm";
import { enqueueEmail } from "../lib/email";
import { logger } from "../lib/logger";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function processSurveyEmails(): Promise<{ sent: number }> {
  const [settings] = await db.select().from(surveySettings).limit(1);
  const enabled = settings?.enabled ?? true;
  if (!enabled) return { sent: 0 };

  const delayDays = settings?.delayDays ?? 3;
  const delayMs = delayDays * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - delayMs);

  const eligibleOrders = await db
    .select({ id: orders.id, email: orders.guestEmail, orderNumber: orders.orderNumber, userId: orders.userId })
    .from(orders)
    .leftJoin(surveyResponses, eq(surveyResponses.orderId, orders.id))
    .where(and(eq(orders.status, "COMPLETED"), lte(orders.updatedAt, cutoff), isNull(surveyResponses.id)))
    .limit(20);

  let sent = 0;
  const subject = settings?.emailSubject || "How was your experience?";
  const customBody = settings?.emailBody;
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0] || "localhost:3000";
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  for (const order of eligibleOrders) {
    const token = generateToken();
    const surveyUrl = `${baseUrl}/survey/${token}`;
    const stars = [1, 2, 3, 4, 5].map((n) =>
      `<a href="${surveyUrl}?r=${n}" style="text-decoration:none;font-size:32px;margin:0 4px;color:${n <= 3 ? "#f59e0b" : "#22c55e"}">${"★"}</a>`
    ).join("");

    let html: string;
    if (customBody) {
      html = customBody.replace(/\{\{orderNumber\}\}/g, order.orderNumber).replace(/\{\{stars\}\}/g, stars).replace(/\{\{surveyUrl\}\}/g, surveyUrl);
    } else {
      html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#1e40af">How was your order?</h2>
        <p>Hi! Your order <strong>${order.orderNumber}</strong> was recently completed. We'd love to hear how it went.</p>
        <p style="margin:24px 0;text-align:center">${stars}</p>
        <p style="text-align:center;color:#6b7280;font-size:14px">Click a star to rate your experience</p>
        <p style="text-align:center;margin-top:16px"><a href="${surveyUrl}" style="color:#3b82f6;font-size:14px">Or leave detailed feedback →</a></p>
      </div>`;
    }

    try {
      await enqueueEmail(order.email, subject, html, { type: "survey", orderId: order.id });
      await db.insert(surveyResponses).values({ orderId: order.id, userId: order.userId, token });
      sent++;
    } catch { /* skip failed sends — order remains eligible for retry */ }
  }
  return { sent };
}

export async function submitSurvey(token: string, rating: number, comment?: string) {
  const [survey] = await db.select().from(surveyResponses).where(eq(surveyResponses.token, token)).limit(1);
  if (!survey) return { error: "Survey not found" };
  if (survey.submittedAt) return { error: "Survey already submitted" };

  await db.update(surveyResponses).set({ rating, comment: comment || null, submittedAt: new Date() }).where(eq(surveyResponses.id, survey.id));

  if (rating <= 2) {
    await createLowRatingTicket(survey, rating, comment);
  }

  return { success: true, rating };
}

async function createLowRatingTicket(survey: typeof surveyResponses.$inferSelect, rating: number, comment?: string) {
  try {
    const maxResult = await db.select({ mx: sql<string>`COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INTEGER)), 0)` }).from(supportTickets);
    const nextNum = parseInt(maxResult[0]?.mx ?? "0", 10) + 1;
    const ticketNumber = `TKT-${String(nextNum).padStart(5, "0")}`;

    const [ticket] = await db.insert(supportTickets).values({
      ticketNumber,
      userId: survey.userId,
      orderId: survey.orderId,
      category: "ORDER_ISSUE",
      subject: `Low survey rating (${rating}/5) - Order follow-up`,
      status: "OPEN",
      priority: rating === 1 ? "HIGH" : "MEDIUM",
    }).returning();

    await db.insert(ticketMessages).values({
      ticketId: ticket.id,
      senderId: survey.userId,
      isStaff: false,
      isInternal: false,
      body: comment || `Customer rated their experience ${rating}/5 stars. Auto-created for follow-up.`,
    });

    await db.insert(ticketStatusHistory).values({
      ticketId: ticket.id,
      toStatus: "OPEN",
      note: "Auto-created from low survey rating",
    });

    logger.info({ ticketNumber, rating, orderId: survey.orderId }, "Support ticket created for low survey rating");
  } catch (err) {
    logger.error({ err, surveyId: survey.id }, "Failed to create support ticket for low rating");
  }
}

export async function getSurveyByToken(token: string) {
  const [survey] = await db.select().from(surveyResponses).where(eq(surveyResponses.token, token)).limit(1);
  return survey ?? null;
}

export async function getSurveyStats() {
  const all = await db.select({ rating: surveyResponses.rating }).from(surveyResponses).where(sql`${surveyResponses.submittedAt} IS NOT NULL`);
  const total = all.length;
  if (total === 0) return { total: 0, avg: 0, nps: 0, distribution: [0, 0, 0, 0, 0] };
  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  let promoters = 0;
  let detractors = 0;
  for (const r of all) {
    const v = r.rating ?? 0;
    if (v >= 1 && v <= 5) distribution[v - 1]++;
    sum += v;
    if (v >= 4) promoters++;
    else if (v <= 2) detractors++;
  }
  const avg = Math.round((sum / total) * 10) / 10;
  const nps = Math.round(((promoters - detractors) / total) * 100);
  return { total, avg, nps, distribution };
}

export async function getRecentSurveys(limit = 50) {
  return db.select().from(surveyResponses)
    .where(sql`${surveyResponses.submittedAt} IS NOT NULL`)
    .orderBy(desc(surveyResponses.submittedAt))
    .limit(limit);
}

export async function getSurveySettings() {
  const [settings] = await db.select().from(surveySettings).limit(1);
  return settings;
}

export async function updateSurveySettings(data: { enabled?: boolean; delayDays?: number; emailSubject?: string; emailBody?: string }) {
  const [existing] = await db.select({ id: surveySettings.id }).from(surveySettings).limit(1);
  if (existing) {
    await db.update(surveySettings).set({ ...data, updatedAt: new Date() }).where(eq(surveySettings.id, existing.id));
  } else {
    await db.insert(surveySettings).values({ enabled: data.enabled ?? true, delayDays: data.delayDays ?? 3, emailSubject: data.emailSubject ?? "How was your experience?", emailBody: data.emailBody });
  }
}
