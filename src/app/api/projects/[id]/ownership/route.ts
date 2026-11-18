import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canManageProject } from "@/lib/project-access";
import {
  assertCollaborationEligible,
  collaborationEligible,
  COLLABORATION_RESTRICTION,
} from "@/lib/eligibility";
import {
  transferInput,
  transferDecision,
  transferResolvable,
} from "@/lib/project-lifecycle";
import { notifyLifecycle } from "@/lib/lifecycle-notifications";
export const GET = endpoint(async (r, c) => {
  const u = await actor();
  const { id } = await c.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw new HttpError(404, "Project not found");
  const manager = await canManageProject(u, project);
  const invited = await db.ownershipTransfer.findFirst({
    where: {
      projectId: id,
      toUserId: u.id,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });
  if (!manager && !invited)
    throw new HttpError(403, "Ownership access required");
  const owners = await db.projectOwner.findMany({
    where: { projectId: id },
    select: {
      userId: true,
      addedAt: true,
      user: { select: { id: true, name: true } },
    },
  });
  const transfers = await db.ownershipTransfer.findMany({
    where: { projectId: id, ...(!manager ? { toUserId: u.id } : {}) },
    select: {
      id: true,
      kind: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json(
    { primaryOwnerId: project.ownerId, owners, transfers },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await assertCollaborationEligible(u);
  await limit(`ownership:${u.id}`, 5, 3600);
  const { id } = await c.params;
  const input = transferInput.parse(await r.json());
  const target = await db.user.findUnique({ where: { email: input.email } });
  if (!target || target.id === u.id)
    throw new HttpError(
      422,
      "Choose another eligible verified Vic Academy account",
    );
  await assertCollaborationEligible(target);
  const block = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: u.id, blockedId: target.id },
        { blockerId: target.id, blockedId: u.id },
      ],
    },
  });
  if (block)
    throw new HttpError(
      403,
      "This account is unavailable for ownership invitations",
    );
  const transfer = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id} FOR UPDATE`;
    const p = await tx.project.findUnique({
      where: { id },
      include: { owners: true },
    });
    if (!p || !(await canManageProject(u, p, tx)) || p.deletedAt || p.archived)
      throw new HttpError(403, "Project owner access required");
    if (p.ownerId !== u.id && !p.owners.some((owner) => owner.userId === u.id))
      throw new HttpError(
        403,
        "An existing owner must initiate the ownership proposal",
      );
    if (input.kind === "TRANSFER" && p.ownerId !== u.id)
      throw new HttpError(
        403,
        "Only the current primary owner may propose a transfer",
      );
    if (
      input.kind === "ADD_OWNER" &&
      (p.ownerId === target.id || p.owners.some((o) => o.userId === target.id))
    )
      throw new HttpError(409, "This user is already an owner");
    const active = await tx.ownershipTransfer.findFirst({
      where: {
        projectId: id,
        toUserId: target.id,
        kind: input.kind,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });
    if (active)
      throw new HttpError(409, "An ownership proposal is already pending");
    await tx.ownershipTransfer.updateMany({
      where: {
        projectId: id,
        toUserId: target.id,
        kind: input.kind,
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED", resolvedAt: new Date() },
    });
    const result = await tx.ownershipTransfer.create({
      data: {
        projectId: id,
        fromUserId: u.id,
        toUserId: target.id,
        kind: input.kind,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    await notifyLifecycle(
      tx,
      [p.ownerId, ...p.owners.map((o) => o.userId), target.id],
      "OWNERSHIP",
      "Project ownership proposal",
      `${u.name || "A project owner"} proposed ${input.kind === "TRANSFER" ? "a primary ownership transfer" : "adding a co-owner"} for ${p.title}. No ownership changes take effect until the recipient signs in and accepts.`,
      `/projects/${id}/versions`,
      `ownership-proposed:${result.id}`,
    );
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: "OWNERSHIP_PROPOSED",
        targetId: result.id,
      },
    });
    return result;
  });
  return Response.json(
    { id: transfer.id, expiresAt: transfer.expiresAt },
    { status: 201 },
  );
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await assertCollaborationEligible(u);
  await limit(`ownership-decision:${u.id}`, 10, 3600);
  const { id } = await c.params;
  const input = transferDecision.parse(await r.json());
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id} FOR UPDATE`;
    const p = await tx.project.findUnique({
      where: { id },
      include: { owners: true },
    });
    const proposal = await tx.ownershipTransfer.findFirst({
      where: { id: input.transferId, projectId: id },
      include: { fromUser: true, toUser: true },
    });
    if (!p || !proposal)
      throw new HttpError(404, "Ownership proposal not found");
    if (
      input.action === "CANCEL"
        ? proposal.fromUserId !== u.id
        : proposal.toUserId !== u.id
    )
      throw new HttpError(
        403,
        "This ownership proposal is not addressed to you",
      );
    if (!transferResolvable(proposal.status, proposal.expiresAt))
      throw new HttpError(
        409,
        "Ownership proposal has expired or was resolved",
      );
    if (input.action === "ACCEPT") {
      const blocked = await tx.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: proposal.fromUserId, blockedId: proposal.toUserId },
            { blockerId: proposal.toUserId, blockedId: proposal.fromUserId },
          ],
        },
      });
      if (blocked)
        throw new HttpError(403, "This ownership proposal is unavailable");
      const [currentSender, currentRecipient] = await Promise.all([
        tx.user.findUnique({ where: { id: proposal.fromUserId } }),
        tx.user.findUnique({ where: { id: proposal.toUserId } }),
      ]);
      if (
        !collaborationEligible(currentSender) ||
        !collaborationEligible(currentRecipient)
      )
        throw new HttpError(403, COLLABORATION_RESTRICTION);
      const stillOwner =
        p.ownerId === proposal.fromUserId ||
        p.owners.some((o) => o.userId === proposal.fromUserId);
      if (!stillOwner || p.deletedAt || p.archived)
        throw new HttpError(
          409,
          "The initiating owner no longer has authority",
        );
      if (proposal.kind === "TRANSFER" && p.ownerId !== proposal.fromUserId)
        throw new HttpError(
          409,
          "Primary ownership changed; request a new proposal",
        );
      await tx.projectOwner.upsert({
        where: {
          projectId_userId: { projectId: id, userId: proposal.fromUserId },
        },
        create: { projectId: id, userId: proposal.fromUserId },
        update: {},
      });
      await tx.projectOwner.upsert({
        where: { projectId_userId: { projectId: id, userId: u.id } },
        create: { projectId: id, userId: u.id },
        update: {},
      });
      if (proposal.kind === "TRANSFER")
        await tx.project.update({ where: { id }, data: { ownerId: u.id } });
    }
    const status =
      input.action === "ACCEPT"
        ? "ACCEPTED"
        : input.action === "REJECT"
          ? "REJECTED"
          : "CANCELLED";
    await tx.ownershipTransfer.update({
      where: { id: proposal.id },
      data: { status, resolvedAt: new Date() },
    });
    await notifyLifecycle(
      tx,
      [
        p.ownerId,
        ...p.owners.map((o) => o.userId),
        proposal.toUserId,
        proposal.fromUserId,
      ],
      "OWNERSHIP",
      `Project ownership proposal ${status.toLowerCase()}`,
      `${p.title}: ${proposal.kind === "TRANSFER" ? "ownership transfer" : "co-owner invitation"} ${status.toLowerCase()}. Previous owners remain attributed.`,
      `/projects/${id}/versions`,
      `ownership-resolved:${proposal.id}:${status}`,
    );
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: `OWNERSHIP_${status}`,
        targetId: proposal.id,
      },
    });
    await tx.activity.create({
      data: { projectId: id, actorId: u.id, kind: `OWNERSHIP_${status}` },
    });
  });
  return Response.json({ ok: true });
});
