import { createHash } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./http-error";
export async function limit(key: string, max = 30, seconds = 60) {
  key = createHash("sha256").update(key).digest("hex");
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const r = await db.rateLimit.upsert({
    where: { key: `${key}:${bucket}` },
    create: {
      key: `${key}:${bucket}`,
      expiresAt: new Date((bucket + 1) * seconds * 1000),
    },
    update: { count: { increment: 1 } },
  });
  if (r.count > max)
    throw new HttpError(429, "Too many requests. Please try again later.");
}
