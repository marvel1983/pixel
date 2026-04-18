import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { decrypt } from "../encryption";
import { logger } from "../logger";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

let cachedTransporter: Transporter | null = null;
let cachedFrom: string = "";
let configLoadedAt = 0;
const CONFIG_TTL = 5 * 60 * 1000;

async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  const rows = await db.select().from(siteSettings).limit(1);
  const settings = rows[0];
  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
    return null;
  }

  let password: string;
  try {
    password = decrypt(settings.smtpPass);
  } catch {
    password = settings.smtpPass;
  }

  return {
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpSecure,
    user: settings.smtpUser,
    pass: password,
    from: settings.smtpFrom ?? settings.supportEmail ?? `noreply@${settings.smtpHost}`,
  };
}

async function getTransporter(): Promise<{ transporter: Transporter; from: string } | null> {
  if (cachedTransporter && Date.now() - configLoadedAt < CONFIG_TTL) {
    return { transporter: cachedTransporter, from: cachedFrom };
  }

  const config = await loadSmtpConfig();
  if (!config) {
    logger.warn("SMTP not configured — skipping email send");
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  cachedFrom = config.from;
  configLoadedAt = Date.now();

  return { transporter: cachedTransporter, from: cachedFrom };
}

export function invalidateMailerCache(): void {
  cachedTransporter = null;
  configLoadedAt = 0;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  const mailer = await getTransporter();
  if (!mailer) return false;

  try {
    await mailer.transporter.sendMail({
      from: mailer.from,
      to,
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    logger.info({ to, subject }, "Email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email");
    throw err;
  }
}
