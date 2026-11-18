import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint, sameOrigin, limit } from "@/lib/security";
import { emailInput, accountJson } from "@/lib/account-input";
import { enqueueChallenge } from "@/lib/challenges";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const { email } = z.object({ email: emailInput }).parse(await accountJson(r));
  await limit(`resend:${email}`, 5, 3600);
  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.emailVerified && !user.suspended && !user.deletedAt)
    await db.$transaction((tx) =>
      enqueueChallenge(tx, user.id, email, "VERIFY"),
    );
  return Response.json(
    {
      message:
        "If verification is available, a new code will arrive shortly. Please allow at least one minute between requests.",
    },
    { status: 202 },
  );
});
