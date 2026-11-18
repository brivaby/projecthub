import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint, sameOrigin, limit } from "@/lib/security";
import { emailInput, passwordInput, accountJson } from "@/lib/account-input";
import { hashPassword } from "@/lib/password";
import { challengeConfig } from "@/lib/challenge-crypto";
import { enqueueChallenge } from "@/lib/challenges";
const input = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailInput,
    password: passwordInput,
    confirmPassword: z.string(),
    studentId: z.string().trim().max(80).optional(),
    institution: z.string().trim().max(160).optional(),
    terms: z.literal(true),
    community: z.literal(true),
    privacy: z.literal(true),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const v = input.parse(await accountJson(r));
  await limit(`registration:${v.email}`, 5, 3600);
  const passwordHash = await hashPassword(v.password);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${v.email}))`;
    const existing = await tx.user.findUnique({ where: { email: v.email } });
    if (existing?.emailVerified || existing?.suspended || existing?.deletedAt)
      return;
    const now = new Date();
    const user =
      existing ||
      (await tx.user.create({
        data: {
          name: v.name,
          email: v.email,
          passwordHash,
          studentId: v.studentId,
          termsAcceptedAt: now,
          communityAcceptedAt: now,
          privacyAcceptedAt: now,
          profile: {
            create: {
              institution: v.institution || "",
              bio: "",
              interests: [],
              skills: [],
              technologies: [],
              links: [],
            },
          },
        },
      }));
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    const recent = await tx.emailChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: "VERIFY",
        createdAt: {
          gt: new Date(Date.now() - challengeConfig().resendSeconds * 1000),
        },
      },
    });
    if (recent) return;
    if (existing)
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: v.name,
          passwordHash,
          studentId: v.studentId,
          termsAcceptedAt: now,
          communityAcceptedAt: now,
          privacyAcceptedAt: now,
        },
      });
    for (const policy of ["TERMS", "COMMUNITY", "PRIVACY"])
      await tx.consent.create({
        data: {
          userId: user.id,
          policy,
          version: process.env.POLICY_VERSION || "1",
          acceptedAt: now,
        },
      });
    await enqueueChallenge(tx, user.id, v.email, "VERIFY");
  });
  return Response.json(
    {
      message:
        "If this address can be registered, a verification code will arrive shortly.",
    },
    { status: 202 },
  );
});
