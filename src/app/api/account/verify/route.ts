import { z } from "zod";
import { endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { emailInput, codeInput, accountJson } from "@/lib/account-input";
import { consumeChallenge } from "@/lib/challenges";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const { email, code } = z
    .object({ email: emailInput, code: codeInput })
    .parse(await accountJson(r));
  await limit(`verify:${email}`, 15, 3600);
  await consumeChallenge(email, "VERIFY", code, async (tx, userId) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.suspended || user.deletedAt || user.email !== email)
      throw new HttpError(422, "Invalid or expired verification code");
    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    return userId;
  });
  return Response.json({
    message: "Email verified. Sign in with your password.",
  });
});
