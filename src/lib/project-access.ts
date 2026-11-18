import { db } from "./db";
import { active, canRead, type Actor } from "./policies";
import type { Project, Collaborator, Prisma } from "@prisma/client";
import {
  collaborationEligible,
  COLLABORATION_RESTRICTION,
} from "./eligibility";
import { HttpError } from "./http-error";
type ProjectRef = Pick<Project, "id" | "ownerId">;
export async function canManageProject(
  user: Actor | null | undefined,
  project: ProjectRef,
  client: Prisma.TransactionClient | typeof db = db,
) {
  if (!active(user)) return false;
  if (user!.role === "ADMIN" || user!.id === project.ownerId) return true;
  return !!(await client.projectOwner.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user!.id } },
  }));
}
export async function canReviewCourseProject(
  user: Actor | null | undefined,
  project: Project,
  client: Prisma.TransactionClient | typeof db = db,
) {
  if (
    !active(user) ||
    !project.courseId ||
    project.deletedAt ||
    ["DRAFT", "DELETED", "REMOVED", "SUSPENDED"].includes(project.status)
  )
    return false;
  if (user!.role === "ADMIN") return true;
  if (user!.role !== "TEACHER") return false;
  return !!(
    (await client.course.findFirst({
      where: { id: project.courseId, teacherId: user!.id },
    })) ||
    (await client.courseMembership.findFirst({
      where: {
        courseId: project.courseId,
        userId: user!.id,
        status: "APPROVED",
        role: "TEACHER",
      },
    }))
  );
}
export async function canAccessProject(
  user: Actor | null | undefined,
  project: Project,
  collaborators?: Pick<Collaborator, "userId">[],
  client: Prisma.TransactionClient | typeof db = db,
) {
  const coOwner = await canManageProject(user, project, client);
  if (await canReviewCourseProject(user, project, client)) return true;
  const courseMember =
    active(user) && project.courseId
      ? !!(
          (await client.courseMembership.findFirst({
            where: {
              courseId: project.courseId,
              userId: user!.id,
              status: "APPROVED",
            },
          })) ||
          (await client.course.findFirst({
            where: { id: project.courseId, teacherId: user!.id },
          }))
        )
      : false;
  const members =
    collaborators ??
    (active(user)
      ? await client.collaborator.findMany({
          where: { projectId: project.id, userId: user!.id },
          select: { userId: true },
        })
      : []);
  return canRead(user, project, members, { coOwner, courseMember });
}
export async function assertWorkspaceAccess(
  user: Actor,
  project: Project,
  client: Prisma.TransactionClient | typeof db = db,
) {
  if (!collaborationEligible(user))
    throw new HttpError(403, COLLABORATION_RESTRICTION);
  if (
    project.deletedAt ||
    project.archived ||
    ["SUSPENDED", "REMOVED", "DELETED"].includes(project.status)
  )
    throw new HttpError(404, "Workspace not found");
  const coOwner =
    project.ownerId === user.id ||
    !!(await client.projectOwner.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    }));
  if (coOwner) return true;
  const owners = await client.projectOwner.findMany({
    where: { projectId: project.id },
    select: { userId: true },
  });
  if (
    await blockedBetween(
      user.id,
      [project.ownerId, ...owners.map((o) => o.userId)],
      client,
    )
  )
    throw new HttpError(403, "This collaboration is unavailable");
  const member = await client.collaborator.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  if (!member)
    throw new HttpError(403, "Approved collaboration membership required");
  return true;
}
export async function blockedBetween(
  userId: string,
  otherIds: string[],
  client: Prisma.TransactionClient | typeof db = db,
) {
  if (!otherIds.length) return false;
  return !!(await client.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: { in: otherIds } },
        { blockedId: userId, blockerId: { in: otherIds } },
      ],
    },
  }));
}

export { assertCollaborationEligible } from "./eligibility";
