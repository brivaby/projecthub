import { timingSafeEqual } from "node:crypto";
import { flushEmails } from "@/lib/email";
import { db } from "@/lib/db";
export async function POST(r: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const supplied = r.headers.get("authorization") || "";
  if (
    !process.env.CRON_SECRET ||
    expected.length !== supplied.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return Response.json({ processed: await flushEmails() });
}
