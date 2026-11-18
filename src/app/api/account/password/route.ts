import { securityNotice } from "@/lib/security-notices";
import { z } from "zod";
import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { passwordInput, accountJson } from "@/lib/account-input";
import { verifyPassword, hashPassword } from "@/lib/password";
import { endSession } from "@/lib/session";
export const PATCH = endpoint(async (r) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`password:${user.id}`, 5, 3600);
  const value = z
    .object({
      currentPassword: z.string().max(128),
      password: passwordInput,
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: "Passwords must match",
      path: ["confirmPassword"],
    })
    .parse(await accountJson(r));
  const passwordHash = await hashPassword(value.password);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (
      current.suspended ||
      current.deletedAt ||
      !(await verifyPassword(value.currentPassword, current.passwordHash))
    )
      throw new HttpError(403, "Current password is incorrect");
    await securityNotice(
      tx,
      current,
      "Password changed",
      "Your password was changed and existing sessions were signed out. If this was not you, reset your password immediately and contact the academy administrator.",
    );
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.create({
      data: { actorId: user.id, action: "PASSWORD_CHANGED", targetId: user.id },
    });
  });
  await endSession();
  return Response.json({
    message: "Password changed. Sign in again on your devices.",
  });
});
