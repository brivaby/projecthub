import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin } from "@/lib/security";
export const GET = endpoint(async () => {
  const u = await actor();
  return Response.json(
    await db.notification.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
});
export const PATCH = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  await db.notification.updateMany({
    where: { userId: u.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true });
});
