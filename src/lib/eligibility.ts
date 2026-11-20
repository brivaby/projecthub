import { HttpError } from "./http-error";
export const COLLABORATION_RESTRICTION =
  "Collaboration is currently limited to verified Vine Iternational Christian Academy email accounts.";
export type EligibilityUser = {
  id?: string;
  email?: string | null;
  emailVerified?: Date | string | null;
  suspended?: boolean;
  deletedAt?: Date | string | null;
  collaborationRulesAcceptedAt?: Date | string | null;
};
export function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}
export function verifiedVic(user: EligibilityUser | null | undefined) {
  if (
    !user ||
    user.suspended ||
    user.deletedAt ||
    !user.emailVerified ||
    !user.email
  )
    return false;
  const email = normalizedEmail(user.email);
  return (
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@vicacademy\.org$/.test(email) &&
    email.split("@").length === 2
  );
}
export function collaborationEligible(
  user: EligibilityUser | null | undefined,
) {
  return verifiedVic(user) && !!user?.collaborationRulesAcceptedAt;
}
export async function assertCollaborationEligible(
  userOrId: EligibilityUser | string,
) {
  const { db } = await import("./db");
  const id = typeof userOrId === "string" ? userOrId : userOrId.id;
  const current = id ? await db.user.findUnique({ where: { id } }) : null;
  if (!collaborationEligible(current))
    throw new HttpError(403, COLLABORATION_RESTRICTION);
  return current!;
}
