import { currentSession, endSession } from "@/lib/session";
import { redirect } from "next/navigation";
export async function auth() {
  const session = await currentSession();
  if (
    !session ||
    session.expires <= new Date() ||
    session.user.suspended ||
    session.user.deletedAt ||
    !session.user.emailVerified
  )
    return null;
  const { id, name, email, image, role, emailVerified } = session.user;
  return {
    user: { id, name, email, image, role, emailVerified },
    expires: session.expires.toISOString(),
  };
}
export async function signOut(options?: { redirectTo?: string }) {
  await endSession();
  redirect(options?.redirectTo || "/");
}
