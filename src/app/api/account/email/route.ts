import { securityNotice } from "@/lib/security-notices";
import { z } from "zod";
import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { emailInput, codeInput, accountJson } from "@/lib/account-input";
import { verifyPassword } from "@/lib/password";
import { enqueueChallenge, consumeChallenge } from "@/lib/challenges";
import { endSession } from "@/lib/session";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`email-change:${u.id}`, 5, 3600);
  const v = z
    .object({ email: emailInput, currentPassword: z.string().max(128) })
    .parse(await accountJson(r));
  if (!(await verifyPassword(v.currentPassword, u.passwordHash)))
    throw new HttpError(403, "Current password is incorrect");
  const existing = await db.user.findUnique({ where: { email: v.email } });
  if (!existing)
    await db.$transaction((tx) =>
      enqueueChallenge(tx, u.id, v.email, "EMAIL_CHANGE"),
    );
  return Response.json(
    {
      message:
        "If this address is available, a confirmation code will arrive shortly. Your existing email remains active until confirmation.",
    },
    { status: 202 },
  );
});
export const PATCH = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  const v = z
    .object({ email: emailInput, code: codeInput })
    .parse(await accountJson(r));
  await limit(`email-confirm:${u.id}`, 10, 3600);
  await consumeChallenge(
    v.email,
    "EMAIL_CHANGE",
    v.code,
    async (tx, userId) => {
      if (userId !== u.id)
        throw new HttpError(403, "Invalid verification code");
      await securityNotice(
        tx,
        u,
        "Account email changed",
        "Your account email was changed after verification. Existing sessions were signed out and collaboration consent must be renewed. Contact the academy administrator if you did not authorize this change.",
      );
      await tx.user.update({
        where: { id: u.id },
        data: {
          email: v.email,
          emailVerified: new Date(),
          collaborationRulesAcceptedAt: null,
        },
      });
      await tx.session.deleteMany({ where: { userId: u.id } });
      await tx.auditLog.create({
        data: { actorId: u.id, action: "EMAIL_CHANGED", targetId: u.id },
      });
      return true;
    },
  );
  await endSession();
  return Response.json({
    message:
      "Email changed and verified. Sign in again. Collaboration eligibility will be rechecked.",
  });
});
