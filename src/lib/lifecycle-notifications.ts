import type { Prisma } from "@prisma/client";
import { emailTemplate } from "./email";
export async function notifyLifecycle(
  tx: Prisma.TransactionClient,
  userIds: string[],
  kind: string,
  title: string,
  message: string,
  href: string,
  eventKey: string,
) {
  const recipients = await tx.user.findMany({
    where: {
      id: { in: [...new Set(userIds)] },
      suspended: false,
      deletedAt: null,
    },
    include: { notificationPreferences: { where: { kind } } },
  });
  for (const recipient of recipients) {
    const pref = recipient.notificationPreferences[0];
    if (recipient.inAppNotifications && pref?.inApp !== false)
      await tx.notification.create({
        data: { userId: recipient.id, title, href },
      });
    if (
      recipient.email &&
      recipient.emailNotifications &&
      pref?.email !== false
    )
      await tx.emailEvent.upsert({
        where: { dedupeKey: `${eventKey}:${recipient.id}` },
        create: {
          dedupeKey: `${eventKey}:${recipient.id}`,
          recipient: recipient.email,
          subject: title,
          html: emailTemplate(title, message, `${process.env.APP_URL}${href}`),
        },
        update: {},
      });
  }
}
