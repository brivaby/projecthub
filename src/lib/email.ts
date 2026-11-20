import nodemailer from "nodemailer";
import { decryptEmailBody } from "./email-secrets";
import { db } from "./db";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const templateTitles = {
  COMMENT: "New comment request",
  COLLABORATION: "New collaboration request",
  CLONE: "New clone request",
  ACCEPTED: "Request accepted",
  REJECTED: "Request rejected",
  NEEDS_INFO: "More information requested",
  COLLABORATOR: "You have been added as a collaborator",
  FEATURED: "Your project has been featured",
  VERIFICATION: "Verify your account",
  RESET: "Sign in securely to your account",
};
export function emailTemplate(title: string, message: string, href: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#19352c"><h2>Vine Iternational Christian Academy ProjectHub<span style="color:#a22280">.</span></h2><hr/><h1 style="font-size:24px">${escapeHtml(title)}</h1><p style="white-space:pre-wrap">${escapeHtml(message)}</p><p><a href="${escapeHtml(href)}" style="background:#a22280;color:white;padding:12px 20px;display:inline-block">Review in ProjectHub</a></p><p>Academic ideas. Shared possibilities.</p><small>This link requires secure sign-in. Manage notifications in your profile.</small></div>`;
}
export async function deliver(
  to: string,
  subject: string,
  html: string,
  messageId?: string,
) {
  if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST)
    throw new Error("SMTP is not configured");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    messageId,
    from:
      process.env.EMAIL_FROM ||
      "Vine Iternational Christian Academy ProjectHub <notifications@projecthub.local>",
    to,
    subject,
    html,
  });
}
// Claim work atomically. Stable Message-ID and transactional deduplication prevent duplicate application enqueueing.
export async function flushEmails() {
  const pending = await db.$queryRaw<
    { id: string }[]
  >`UPDATE "EmailEvent" SET status='SENDING' WHERE id IN (SELECT id FROM "EmailEvent" WHERE status IN ('PENDING','RETRY') AND "nextAttemptAt"<=NOW() ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 20) RETURNING id`;
  for (const { id } of pending) {
    const e = await db.emailEvent.findUniqueOrThrow({ where: { id } });
    try {
      await deliver(
        e.recipient,
        e.subject,
        decryptEmailBody(e.html),
        `<${e.id}@${new URL(process.env.APP_URL || "http://localhost:3000").hostname}>`,
      );
      await db.emailEvent.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          ...(e.dedupeKey?.startsWith("challenge:") ? { html: "" } : {}),
          attempts: { increment: 1 },
        },
      });
    } catch {
      await db.emailEvent.update({
        where: { id },
        data: {
          status: e.attempts >= 4 ? "FAILED" : "RETRY",
          attempts: { increment: 1 },
          error: "SMTP delivery failed",
          nextAttemptAt: new Date(Date.now() + 2 ** e.attempts * 60000),
        },
      });
    }
  }
  return pending.length;
}
