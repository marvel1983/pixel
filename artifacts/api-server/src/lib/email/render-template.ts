import { db } from "@workspace/db";
import { emailTemplates } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./mailer";
import { logger } from "../logger";

export async function renderAndSendTemplate(
  templateKey: string,
  toEmail: string,
  variables: Record<string, string>,
): Promise<boolean> {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.key, templateKey));

  if (!template || !template.isEnabled) {
    logger.warn({ templateKey }, "Email template not found or disabled");
    return false;
  }

  let subject = template.subject;
  let body = template.bodyHtml;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, value);
  }

  try {
    return await sendEmail(toEmail, subject, body);
  } catch (err) {
    logger.error({ templateKey, toEmail, err }, "Failed to send templated email");
    return false;
  }
}
