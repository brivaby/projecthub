import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canManageProject, blockedBetween } from "@/lib/project-access";
import {
  collaborationEligible,
  COLLABORATION_RESTRICTION,
} from "@/lib/eligibility";
import { assertRequestDecision } from "@/lib/request-decisions";
import { z } from "zod";
import { emailTemplate } from "@/lib/email";
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`decision:${user.id}`, 30);
  const { id } = await c.params;
  const value = z
    .object({
      status: z.enum([
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "NEEDS_INFO",
        "CANCELLED",
        "COMPLETED",
      ]),
      response: z.string().max(2000).default(""),
      privateNote: z.string().max(2000).optional(),
    })
    .parse(await r.json());
  const reference = await db.request.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!reference) throw new HttpError(404, "Request not found");
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${reference.projectId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Request" WHERE id=${id} FOR UPDATE`;
    const request = await tx.request.findUnique({
      where: { id },
      include: {
        project: {
          include: { owner: true, owners: { include: { user: true } } },
        },
        user: true,
      },
    });
    if (!request) throw new HttpError(404, "Request not found");
    const owner = await canManageProject(user, request.project, tx);
    const requester = request.userId === user.id;
    if (!owner && !requester) throw new HttpError(403, "Access denied");
    if (
      request.expiresAt &&
      request.expiresAt <= new Date() &&
      ["PENDING", "NEEDS_INFO"].includes(request.status)
    ) {
      await tx.request.update({ where: { id }, data: { status: "EXPIRED" } });
      return "EXPIRED";
    }
    assertRequestDecision({
      current: request.status,
      next: value.status,
      owner,
      requester,
      response: value.response,
    });
    if (value.privateNote !== undefined && !owner)
      throw new HttpError(403, "Private notes are owner-only");
    if (
      request.project.deletedAt ||
      request.project.archived ||
      ["SUSPENDED", "REMOVED", "DELETED"].includes(request.project.status)
    )
      throw new HttpError(409, "Project is not accepting request decisions");
    if (request.type === "COLLABORATION") {
      for (const userId of [...new Set([user.id, request.userId])].sort())
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      const currentActor = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      const currentRequester = await tx.user.findUniqueOrThrow({
        where: { id: request.userId },
      });
      if (
        !collaborationEligible(currentActor) ||
        !collaborationEligible(currentRequester)
      )
        throw new HttpError(403, COLLABORATION_RESTRICTION);
      if (
        value.status === "ACCEPTED" &&
        request.project.collaboration === "CLOSED"
      )
        throw new HttpError(403, "Collaboration is closed");
    }
    const ownerIds = [
      request.project.ownerId,
      ...request.project.owners.map((o) => o.userId),
    ];
    if (
      value.status === "ACCEPTED" &&
      (await blockedBetween(request.userId, ownerIds, tx))
    )
      throw new HttpError(403, "This interaction is unavailable");
    if (
      value.status === "ACCEPTED" &&
      request.type === "CLONE" &&
      (!request.project.cloningAllowed ||
        request.project.clonePolicy === "DISABLED")
    )
      throw new HttpError(403, "Cloning is closed");
    await tx.request.update({
      where: { id },
      data: {
        status: value.status,
        response: value.status === "PENDING" ? null : value.response,
        ...(value.privateNote === undefined
          ? {}
          : { privateNote: value.privateNote }),
        ...(value.status === "PENDING"
          ? {
              message: `${request.message}\n\nAdditional information: ${value.response}`,
            }
          : {}),
      },
    });
    if (value.status === "ACCEPTED") {
      if (request.type === "COLLABORATION")
        await tx.collaborator.upsert({
          where: {
            projectId_userId: {
              projectId: request.projectId,
              userId: request.userId,
            },
          },
          create: {
            projectId: request.projectId,
            userId: request.userId,
            permission: request.permission,
          },
          update: { permission: request.permission },
        });
      if (request.type === "COMMENT") {
        const details = request.details as {
          editCommentId?: string;
          parentId?: string | null;
        };
        if (details.editCommentId) {
          const comment = await tx.comment.findFirst({
            where: {
              id: details.editCommentId,
              projectId: request.projectId,
              userId: request.userId,
              status: { not: "HIDDEN" },
            },
          });
          if (!comment) throw new HttpError(404, "Comment no longer exists");
          await tx.comment.update({
            where: { id: comment.id },
            data: { body: request.message, status: "PUBLIC" },
          });
        } else {
          if (
            details.parentId &&
            !(await tx.comment.findFirst({
              where: {
                id: details.parentId,
                projectId: request.projectId,
                status: "PUBLIC",
              },
            }))
          )
            throw new HttpError(422, "Reply target is unavailable");
          await tx.comment.create({
            data: {
              projectId: request.projectId,
              userId: request.userId,
              body: request.message,
              parentId: details.parentId || null,
            },
          });
        }
      }
    }
    const title =
      request.type === "COLLABORATION" && value.status === "ACCEPTED"
        ? "Collaborator added"
        : `${request.type.toLowerCase()} request ${value.status.toLowerCase().replace("_", " ")}`;
    const recipients =
      value.status === "PENDING"
        ? [request.project.owner, ...request.project.owners.map((o) => o.user)]
        : [request.user];
    const seen = new Set<string>();
    for (const recipient of recipients) {
      if (seen.has(recipient.id)) continue;
      seen.add(recipient.id);
      if (request.type === "COLLABORATION" && !collaborationEligible(recipient))
        continue;
      if (recipient.inAppNotifications)
        await tx.notification.create({
          data: {
            userId: recipient.id,
            title: `${title}: ${request.project.title}`,
            href: "/requests",
          },
        });
      if (recipient.email && recipient.emailNotifications)
        await tx.emailEvent.create({
          data: {
            dedupeKey: `decision:${id}:${value.status}:${request.updatedAt.toISOString()}:${recipient.id}`,
            recipient: recipient.email,
            subject: title,
            html: emailTemplate(
              title,
              `${request.user.name || "A student"} · ${request.project.title}\n${value.response}`,
              `${process.env.APP_URL}/requests`,
            ),
          },
        });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: `REQUEST_${value.status}`,
        targetId: id,
      },
    });
    await tx.activity.create({
      data: {
        projectId: request.projectId,
        actorId: user.id,
        kind: `REQUEST_${value.status}`,
      },
    });
    return "OK";
  });
  if (outcome === "EXPIRED")
    throw new HttpError(409, "This request has expired");
  return Response.json({ ok: true });
});
