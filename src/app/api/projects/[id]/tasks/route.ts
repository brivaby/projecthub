import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { assertCollaborationEligible } from "@/lib/eligibility";
import { assertWorkspaceAccess, blockedBetween } from "@/lib/project-access";
import { taskInput, canEditWorkspaceTasks } from "@/lib/education";
import { z } from "zod";
async function access(projectId: string, write = false) {
  const user = await actor();
  await assertCollaborationEligible(user.id);
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Workspace unavailable");
  await assertWorkspaceAccess(user, project);
  const owners = await db.projectOwner.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const owner =
    project.ownerId === user.id || owners.some((o) => o.userId === user.id);
  if (
    !owner &&
    (await blockedBetween(user.id, [
      project.ownerId,
      ...owners.map((o) => o.userId),
    ]))
  )
    throw new HttpError(403, "Workspace unavailable");

  const membership = await db.collaborator.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (write && !canEditWorkspaceTasks(membership?.permission, owner))
    throw new HttpError(403, "Contributor access is required to change tasks");
  return {
    user,
    project,
    owner,
    canEdit: canEditWorkspaceTasks(membership?.permission, owner),
  };
}
async function validAssignee(projectId: string, assigneeId: string | null) {
  if (!assigneeId) return;
  await assertCollaborationEligible(assigneeId);
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const assignee = await db.user.findUniqueOrThrow({
    where: { id: assigneeId },
  });
  await assertWorkspaceAccess(assignee, project);
  if (
    project.ownerId !== assignee.id &&
    !(await db.projectOwner.findUnique({
      where: { projectId_userId: { projectId, userId: assignee.id } },
    })) &&
    !(await db.collaborator.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
    }))
  )
    throw new HttpError(
      422,
      "Assign tasks only to approved eligible project members",
    );
}
export const GET = endpoint(async (r, c) => {
  const { id } = await c.params;
  const { canEdit } = await access(id);
  const tasks = await db.workspaceTask.findMany({
    where: { projectId: id },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: [{ milestone: "desc" }, { createdAt: "asc" }],
  });
  return Response.json(
    { tasks, canEdit },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const { id } = await c.params;
  const { user } = await access(id, true);
  await limit(`workspace-task:${user.id}`, 30, 3600);
  const v = taskInput.parse(await r.json());
  await validAssignee(id, v.assigneeId);
  const task = await db.$transaction(async (tx) => {
    const task = await tx.workspaceTask.create({
      data: { ...v, projectId: id, dueAt: v.dueAt ? new Date(v.dueAt) : null },
    });
    await tx.activity.create({
      data: {
        projectId: id,
        actorId: user.id,
        kind: v.milestone ? "MILESTONE_CREATED" : "TASK_CREATED",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "WORKSPACE_TASK_CREATED",
        targetId: task.id,
      },
    });
    return task;
  });
  return Response.json({ id: task.id }, { status: 201 });
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const { id } = await c.params;
  const { user } = await access(id, true);
  await limit(`workspace-task:${user.id}`, 30, 3600);
  const { taskId, ...v } = taskInput
    .extend({ taskId: z.string().min(1) })
    .parse(await r.json());
  await validAssignee(id, v.assigneeId);
  const existing = await db.workspaceTask.findFirst({
    where: { id: taskId, projectId: id },
  });
  if (!existing) throw new HttpError(404, "Task unavailable");
  await db.$transaction([
    db.workspaceTask.update({
      where: { id: taskId },
      data: { ...v, dueAt: v.dueAt ? new Date(v.dueAt) : null },
    }),
    db.activity.create({
      data: { projectId: id, actorId: user.id, kind: "TASK_UPDATED" },
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: "WORKSPACE_TASK_UPDATED",
        targetId: taskId,
      },
    }),
  ]);
  return Response.json({ ok: true });
});
export const DELETE = endpoint(async (r, c) => {
  sameOrigin(r);
  const { id } = await c.params;
  const { user } = await access(id, true);
  await limit(`workspace-task:${user.id}`, 30, 3600);
  const { taskId } = z
    .object({ taskId: z.string().min(1) })
    .parse(await r.json());
  const task = await db.workspaceTask.findFirst({
    where: { id: taskId, projectId: id },
  });
  if (!task) throw new HttpError(404, "Task unavailable");
  await db.$transaction([
    db.workspaceTask.delete({ where: { id: taskId } }),
    db.activity.create({
      data: { projectId: id, actorId: user.id, kind: "TASK_REMOVED" },
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: "WORKSPACE_TASK_REMOVED",
        targetId: taskId,
      },
    }),
  ]);
  return Response.json({ ok: true });
});
