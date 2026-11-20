import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { emailTemplate } from "./email";
// Essential account-security mail is transactional, not a marketing preference.
export async function securityNotice(
  tx: Prisma.TransactionClient,
  user: { id: string; email: string | null },
  event: string,
  message: string,
) {
  if (!user.email) return;
  await tx.emailEvent.create({
    data: {
      dedupeKey: `security:${event}:${user.id}:${randomUUID()}`,
      recipient: user.email,
      subject: `Vine Iternational Christian Academy ProjectHub: ${event}`,
      html: emailTemplate(event, message, `${process.env.APP_URL}/account`),
    },
  });
}
