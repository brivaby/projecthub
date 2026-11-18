import type { User, Project, Collaborator } from "@prisma/client";
import { collaborationEligible, verifiedVic } from "./eligibility";
export type Actor = Pick<User, "id" | "role" | "suspended" | "deletedAt"> &
  Partial<
    Pick<User, "email" | "emailVerified" | "collaborationRulesAcceptedAt">
  >;
type Owned = { ownerId: string; owners?: { userId: string }[] };
export function active(u: Actor | null | undefined) {
  return !!u && !u.suspended && !u.deletedAt;
}
export function canManage(u: Actor | null | undefined, p: Owned) {
  return (
    active(u) &&
    (u!.role === "ADMIN" ||
      u!.id === p.ownerId ||
      !!p.owners?.some((o) => o.userId === u!.id))
  );
}
export function canRead(
  u: Actor | null | undefined,
  p: Pick<Project, "ownerId" | "visibility" | "deletedAt" | "archived"> &
    Partial<Pick<Project, "status" | "scheduledAt">> &
    Owned,
  collaborators: Pick<Collaborator, "userId">[] = [],
  context: { courseMember?: boolean; coOwner?: boolean } = {},
) {
  if (canManage(u, p) || context.coOwner) return active(u);
  if (
    p.deletedAt ||
    p.archived ||
    ["DRAFT", "PENDING_REVIEW", "SUSPENDED", "REMOVED", "DELETED"].includes(
      p.status || "",
    )
  )
    return false;
  if (
    p.visibility === "SCHEDULED" &&
    (!p.scheduledAt || p.scheduledAt > new Date())
  )
    return false;
  if (p.visibility === "INSTITUTION") return verifiedVic(u);
  if (p.visibility === "COURSE")
    return verifiedVic(u) && !!context.courseMember;
  if (p.visibility === "PRIVATE")
    return (
      active(u) &&
      collaborationEligible(u) &&
      collaborators.some((c) => c.userId === u!.id)
    );
  return ["PUBLIC", "UNLISTED", "SCHEDULED"].includes(p.visibility);
}
export function canDownload(
  u: Actor | null | undefined,
  p: Owned,
  collaborators: Pick<Collaborator, "userId">[],
  cloneApproved = false,
) {
  return (
    canManage(u, p) ||
    (active(u) &&
      (cloneApproved ||
        (collaborationEligible(u) &&
          collaborators.some((c) => c.userId === u!.id))))
  );
}
