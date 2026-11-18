import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canManageProject, blockedBetween } from "@/lib/project-access";
import {
  collaborationEligible,
  COLLABORATION_RESTRICTION,
  assertCollaborationEligible,
} from "@/lib/eligibility";
import { emailTemplate } from "@/lib/email";
import { z } from "zod";
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`collaborator:${user.id}`, 20, 3600);
  await assertCollaborationEligible(user);
  const { id } = await c.params;
  const project = await db.project.findUnique({
    where: { id },
    include: { owners: true },
  });
  if (
    !project ||
    project.deletedAt ||
    project.archived ||
    ["SUSPENDED", "REMOVED", "DELETED"].includes(project.status) ||
    !(await canManageProject(user, project))
  )
    throw new HttpError(403, "Owner access required");
  const value = z
    .object({
      userId: z.string(),
      permission: z
        .enum(["VIEWER", "COMMENTER", "CONTRIBUTOR", "EDITOR", "MANAGER"])
        .nullable(),
    })
    .parse(await r.json());
  if (
    value.userId === project.ownerId ||
    project.owners.some((o) => o.userId === value.userId)
  )
    throw new HttpError(422, "Manage owners through the ownership workflow");
  if (value.permission && (await blockedBetween(user.id, [value.userId])))
    throw new HttpError(403, "This interaction is unavailable");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id} FOR UPDATE`;
    const liveProject = await tx.project.findUniqueOrThrow({ where: { id } });
    if (
      !(await canManageProject(user, liveProject, tx)) ||
      liveProject.deletedAt ||
      liveProject.archived
    )
      throw new HttpError(403, "Owner access required");
    for (const userId of [...new Set([user.id, value.userId])].sort())
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const acting = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    const target = await tx.user.findUnique({ where: { id: value.userId } });
    if (
      !collaborationEligible(acting) ||
      (value.permission && !collaborationEligible(target))
    )
      throw new HttpError(403, COLLABORATION_RESTRICTION);
    const member = await tx.collaborator.findUnique({
      where: { projectId_userId: { projectId: id, userId: value.userId } },
    });
    if (value.permission && !member)
      throw new HttpError(
        403,
        "An accepted collaboration request is required before adding members",
      );
    if (value.permission)
      await tx.collaborator.update({
        where: { projectId_userId: { projectId: id, userId: value.userId } },
        data: { permission: value.permission },
      });
    else
      await tx.collaborator.deleteMany({
        where: { projectId: id, userId: value.userId },
      });
    const action = value.permission ? "PERMISSION_UPDATED" : "ACCESS_REVOKED";
    await tx.activity.create({
      data: { projectId: id, actorId: user.id, kind: action },
    });
    await tx.auditLog.create({
      data: { actorId: user.id, action, targetId: id },
    });
    if (target && collaborationEligible(target)) {
      const title = value.permission
        ? "Collaboration permissions updated"
        : "Collaborator access removed";
      if (target.inAppNotifications)
        await tx.notification.create({
          data: {
            userId: target.id,
            title: `${title}: ${project.title}`,
            href: "/requests",
          },
        });
      if (target.email && target.emailNotifications)
        await tx.emailEvent.create({
          data: {
            dedupeKey: `member:${id}:${target.id}:${action}:${Date.now()}`,
            recipient: target.email,
            subject: title,
            html: emailTemplate(
              title,
              `Your access to ${project.title} has changed. ${value.permission ? `Your permission level is ${value.permission}.` : "You no longer have collaboration workspace access."}`,
              `${process.env.APP_URL}/requests`,
            ),
          },
        });
    }
  });
  return Response.json({ ok: true });
});
