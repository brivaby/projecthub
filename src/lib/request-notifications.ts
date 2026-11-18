import type { Prisma, User, Request, Project } from "@prisma/client";
import { collaborationEligible } from "./eligibility";
import { emailTemplate, templateTitles } from "./email";
export async function notifyRequest(
  tx: Prisma.TransactionClient,
  request: Pick<Request, "id" | "type" | "message">,
  requester: User,
  project: Pick<Project, "id" | "title"> & { owner: User },
) {
  const href = `${process.env.APP_URL}/requests?request=${request.id}`;
  const title = templateTitles[request.type];
  const message = `${requester.name || "A student"} submitted a ${request.type.toLowerCase()} request for ${project.title}.\n\n${request.message}`;
  const coOwners = await tx.projectOwner.findMany({
    where: { projectId: project.id },
    include: { user: true },
  });
  const recipients = [
    ...new Map(
      [project.owner, ...coOwners.map((o) => o.user), requester].map((u) => [
        u.id,
        u,
      ]),
    ).values(),
  ];
  for (const recipient of recipients) {
    if (request.type === "COLLABORATION" && !collaborationEligible(recipient))
      continue;
    const preference=await tx.notificationPreference.findUnique({where:{userId_kind:{userId:recipient.id,kind:request.type}}});
    if (recipient.email && recipient.emailNotifications&&preference?.email!==false)
      await tx.emailEvent.create({
        data: {
          dedupeKey: `request:${request.id}:${recipient.id}`,
          recipient: recipient.email,
          subject:
            recipient.id === requester.id ? "Your request was received" : title,
          html: emailTemplate(title, message, href),
        },
      });
    if (recipient.inAppNotifications&&preference?.inApp!==false)
      await tx.notification.create({
        data: {
          userId: recipient.id,
          title:
            recipient.id === requester.id
              ? `Request submitted: ${project.title}`
              : `${title}: ${project.title}`,
          href: "/requests",
        },
      });
  }
}
