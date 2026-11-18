import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import {
  canAccessProject,
  canManageProject,
  blockedBetween,
} from "@/lib/project-access";
import {
  collaborationEligible,
  COLLABORATION_RESTRICTION,
  verifiedVic,
} from "@/lib/eligibility";
import { requestInput } from "@/lib/validation";
import { notifyRequest } from "@/lib/request-notifications";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`requests:${user.id}`, 8, 3600);
  const { id } = await c.params;
  const value = requestInput.parse(await r.json());
  const project = await db.project.findUnique({
    where: { id },
    include: {
      owner: true,
      owners: { include: { user: true } },
      collaborators: true,
    },
  });
  if (
    !project ||
    !(await canAccessProject(user, project, project.collaborators))
  )
    throw new HttpError(404, "Project not found");
  if (await canManageProject(user, project))
    throw new HttpError(422, "You own or manage this project");
  const ownerIds = [project.ownerId, ...project.owners.map((o) => o.userId)];
  if (await blockedBetween(user.id, ownerIds))
    throw new HttpError(403, "This interaction is unavailable");
  if (value.type === "COLLABORATION" && !collaborationEligible(user))
    throw new HttpError(403, COLLABORATION_RESTRICTION);
  if (
    value.type === "CLONE" &&
    (!project.cloningAllowed || project.clonePolicy === "DISABLED")
  )
    throw new HttpError(403, "Cloning is closed");
  if (value.type === "COLLABORATION" && project.collaboration === "CLOSED")
    throw new HttpError(403, "Collaboration is closed");
  if (
    value.type === "COMMENT" &&
    (project.commentPolicy === "DISABLED" ||
      (project.commentPolicy === "VIC_ONLY" && !verifiedVic(user)))
  )
    throw new HttpError(403, "Commenting is unavailable for this account");
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id} FOR UPDATE`;
    const current = await tx.project.findUniqueOrThrow({
      where: { id },
      include: {
        owner: true,
        owners: { include: { user: true } },
        collaborators: true,
      },
    });
    if (!(await canAccessProject(user, current, current.collaborators, tx)))
      throw new HttpError(404, "Project not found");
    if (
      current.deletedAt ||
      current.archived ||
      ["SUSPENDED", "REMOVED", "DELETED"].includes(current.status)
    )
      throw new HttpError(404, "Project not found");
    if (value.type === "COLLABORATION") {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const live = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!collaborationEligible(live))
        throw new HttpError(403, COLLABORATION_RESTRICTION);
      if (
        current.collaboration === "CLOSED" ||
        ![current.owner, ...current.owners.map((o) => o.user)].some(
          collaborationEligible,
        )
      )
        throw new HttpError(
          403,
          "This project is not accepting collaboration requests",
        );
    }
    if (
      value.type === "CLONE" &&
      (!current.cloningAllowed || current.clonePolicy === "DISABLED")
    )
      throw new HttpError(403, "Cloning is closed");
    const duplicate = await tx.request.findFirst({
      where: {
        projectId: id,
        userId: user.id,
        type: value.type,
        status: { in: ["PENDING", "NEEDS_INFO"] },
      },
    });
    if (duplicate) {
      if (duplicate.expiresAt && duplicate.expiresAt <= new Date())
        await tx.request.update({
          where: { id: duplicate.id },
          data: { status: "EXPIRED" },
        });
      else throw new HttpError(409, "An active request already exists");
    }
    const automatic = value.type === "CLONE" && current.clonePolicy === "AUTO";
    const request = await tx.request.create({
      data: {
        projectId: id,
        userId: user.id,
        ...value,
        status: automatic ? "ACCEPTED" : "PENDING",
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    await notifyRequest(tx, request, user, { ...project, ...current });
    await tx.activity.create({
      data: {
        projectId: id,
        actorId: user.id,
        kind: automatic ? "CLONE_AUTO_APPROVED" : `${value.type}_REQUESTED`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: automatic ? "CLONE_AUTO_APPROVED" : `${value.type}_REQUESTED`,
        targetId: request.id,
      },
    });
    return request;
  });
  return Response.json(
    { id: result.id, status: result.status },
    { status: 201 },
  );
});
