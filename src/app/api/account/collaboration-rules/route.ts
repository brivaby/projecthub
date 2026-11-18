import { z } from "zod";
import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, HttpError } from "@/lib/security";
import { verifiedVic, COLLABORATION_RESTRICTION } from "@/lib/eligibility";
import { accountJson } from "@/lib/account-input";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  if (!verifiedVic(u)) throw new HttpError(403, COLLABORATION_RESTRICTION);
  z.object({ accepted: z.literal(true) }).parse(await accountJson(r));
  await db.$transaction([
    db.user.update({
      where: { id: u.id },
      data: { collaborationRulesAcceptedAt: new Date() },
    }),
    db.consent.create({
      data: {
        userId: u.id,
        policy: "COLLABORATION",
        version: process.env.POLICY_VERSION || "1",
        acceptedAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: {
        actorId: u.id,
        action: "COLLABORATION_RULES_ACCEPTED",
        targetId: u.id,
      },
    }),
  ]);
  return Response.json({ ok: true });
});
