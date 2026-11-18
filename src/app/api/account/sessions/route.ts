import { z } from "zod";
import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin } from "@/lib/security";
import { accountJson } from "@/lib/account-input";
import { currentSession, endSession } from "@/lib/session";
export const GET = endpoint(async () => {
  const u = await actor();
  const current = await currentSession();
  const sessions = await db.session.findMany({
    where: { userId: u.id, expires: { gt: new Date() } },
    select: { id: true, expires: true },
  });
  return Response.json(
    {
      sessions: sessions.map((s) => ({ ...s, current: s.id === current?.id })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const DELETE = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = z.object({ id: z.string() }).parse(await accountJson(r));
  const current = await currentSession();
  await db.session.deleteMany({ where: { id, userId: u.id } });
  if (current?.id === id) await endSession();
  return Response.json({ ok: true });
});
