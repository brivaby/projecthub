import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import {
  canAccessProject,
  canManageProject,
  blockedBetween,
} from "@/lib/project-access";
import { verifiedVic } from "@/lib/eligibility";
import { z } from "zod";
import { notifyRequest } from "@/lib/request-notifications";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`comments:${user.id}`, 10, 600);
  const { id } = await c.params;
  const input = z
    .object({
      body: z.string().trim().min(2).max(4000),
      parentId: z.string().optional(),
    })
    .parse(await r.json());
  const project = await db.project.findUnique({
    where: { id },
    include: { owner: true, owners: true },
  });
  if (!project || !(await canAccessProject(user, project)))
    throw new HttpError(404, "Project not found");
  const manager = await canManageProject(user, project);
  if (
    await blockedBetween(user.id, [
      project.ownerId,
      ...project.owners.map((o) => o.userId),
    ])
  )
    throw new HttpError(403, "Commenting is unavailable");
  if (project.commentPolicy === "DISABLED")
    throw new HttpError(403, "Comments are disabled for this project");
  if (project.commentPolicy === "VIC_ONLY" && !verifiedVic(user))
    throw new HttpError(
      403,
      "Comments on this project require a verified Vic Academy email account",
    );
  if (input.parentId) {
    const parent = await db.comment.findFirst({
      where: { id: input.parentId, projectId: id, status: "PUBLIC" },
    });
    if (!parent) throw new HttpError(422, "Reply target unavailable");
    if (await blockedBetween(user.id, [parent.userId]))
      throw new HttpError(403, "Replies are unavailable");
  }
  const moderation=await db.platformSetting.findUnique({where:{key:"moderation"}});if((moderation?.value as {allowPublicComments?:boolean}|null)?.allowPublicComments===false&&!manager)throw new HttpError(403,"Public commenting is temporarily disabled");
  const duplicate = await db.comment.findFirst({
    where: {
      userId: user.id,
      projectId: id,
      body: input.body,
      createdAt: { gte: new Date(Date.now() - 86400000) },
    },
  });
  if (duplicate) throw new HttpError(409, "This comment was already submitted");
  if (project.commentPolicy === "MODERATED" && !manager) {
    const request = await db.$transaction(async (tx) => {
      const req = await tx.request.create({
        data: {
          projectId: id,
          userId: user.id,
          type: "COMMENT",
          message: input.body,
          details: { parentId: input.parentId || null },
        },
      });
      await notifyRequest(tx, req, user, project);
      return req;
    });
    return Response.json({ id: request.id, pending: true }, { status: 201 });
  }
  const comment = await db.$transaction(async (tx) => {
    const result = await tx.comment.create({
      data: { ...input, projectId: id, userId: user.id },
    });
    const recipients = [
      ...new Set([project.ownerId, ...project.owners.map((o) => o.userId)]),
    ].filter((uid) => uid !== user.id);
    for (const userId of recipients) {
      const recipient = await tx.user.findUnique({
        where: { id: userId },
        select: { inAppNotifications: true },
      });
      if (recipient?.inAppNotifications)
        await tx.notification.create({
          data: {
            userId,
            title: `New comment: ${project.title}`,
            href: `/projects/${id}`,
          },
        });
    }
    if (input.parentId) {
      const parent = await tx.comment.findUnique({
        where: { id: input.parentId },
      });
      if (
        parent &&
        parent.userId !== user.id &&
        !recipients.includes(parent.userId)
      )
        await tx.notification.create({
          data: {
            userId: parent.userId,
            title: "A reply to your project comment",
            href: `/projects/${id}`,
          },
        });
    }
    return result;
  });
  return Response.json({ id: comment.id }, { status: 201 });
});
