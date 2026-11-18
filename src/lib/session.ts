import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { Prisma } from "@prisma/client";
export const SESSION_COOKIE = "vic-session";
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createSession(
  userId: string,
  client: Prisma.TransactionClient | typeof db = db,
) {
  const token = randomBytes(32).toString("hex");
  const seconds = Math.max(
    3600,
    Math.min(
      2592000,
      Math.floor(Number(process.env.SESSION_TTL_SECONDS) || 604800),
    ),
  );
  const expires = new Date(Date.now() + seconds * 1000);
  await client.session.create({
    data: { sessionToken: tokenHash(token), userId, expires },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}
export async function currentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.session.findUnique({
    where: { sessionToken: tokenHash(token) },
    include: { user: true },
  });
}
export async function endSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token)
    await db.session.deleteMany({ where: { sessionToken: tokenHash(token) } });
  (await cookies()).delete(SESSION_COOKIE);
}
