import { securityNotice } from "@/lib/security-notices";
import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import {
  emailInput,
  passwordInput,
  codeInput,
  accountJson,
} from "@/lib/account-input";
import { enqueueChallenge, consumeChallenge } from "@/lib/challenges";
import { hashPassword } from "@/lib/password";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const { email } = z.object({ email: emailInput }).parse(await accountJson(r));
  await limit(`recovery:${email}`, 5, 3600);
  const user = await db.user.findUnique({ where: { email } });
  if (user?.emailVerified && !user.suspended && !user.deletedAt)
    await db.$transaction((tx) =>
      enqueueChallenge(tx, user.id, email, "RESET"),
    );
  return Response.json(
    {
      message:
        "If the address is eligible, a password-reset code will arrive shortly.",
    },
    { status: 202 },
  );
});
export const PATCH = endpoint(async (r) => {
  sameOrigin(r);
  const v = z
    .object({
      email: emailInput,
      code: codeInput,
      password: passwordInput,
      confirmPassword: z.string(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: "Passwords must match",
      path: ["confirmPassword"],
    })
    .parse(await accountJson(r));
  await limit(`reset:${v.email}`, 10, 3600);
  const passwordHash = await hashPassword(v.password);
  await consumeChallenge(v.email, "RESET", v.code, async (tx, userId) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (
      !user.emailVerified ||
      user.suspended ||
      user.deletedAt ||
      user.email !== v.email
    )
      throw new HttpError(422, "Invalid or expired verification code");
    await securityNotice(
      tx,
      user,
      "Password reset",
      "Your password was reset and existing sessions were signed out. If this was not you, contact the academy administrator immediately.",
    );
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
  return Response.json({
    message: "Password reset. All previous sessions have been signed out.",
  });
});
