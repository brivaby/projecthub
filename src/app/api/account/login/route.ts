import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { emailInput, accountJson } from "@/lib/account-input";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
const dummy = hashPassword(randomBytes(24).toString("hex"));
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const { email, password } = z
    .object({ email: emailInput, password: z.string().min(1).max(128) })
    .parse(await accountJson(r));
  await limit(`login:${email}`, 10, 900);
  if (process.env.TRUST_PROXY === "true")
    await limit(
      `login-source:${r.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"}`,
      40,
      900,
    );
  const id = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!id) {
    await verifyPassword(password, await dummy);
    throw new HttpError(
      401,
      "Unable to sign in. Check your credentials and verify your email.",
    );
  }
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id.id} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: id.id } });
    const valid = await verifyPassword(
      password,
      user.passwordHash || (await dummy),
    );
    if (
      !valid ||
      !user.emailVerified ||
      user.suspended ||
      user.deletedAt ||
      user.email !== email
    )
      throw new HttpError(
        401,
        "Unable to sign in. Check your credentials and verify your email.",
      );
    await createSession(user.id, tx);
    await tx.auditLog.create({
      data: { actorId: user.id, action: "LOGIN", targetId: user.id },
    });
  });
  return Response.json({ ok: true, redirectTo: "/dashboard" });
});
