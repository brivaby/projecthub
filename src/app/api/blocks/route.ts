import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { z } from "zod";
export const GET = endpoint(async () => {
  const u = await actor();
  return Response.json(
    await db.userBlock.findMany({
      where: { blockerId: u.id },
      include: { blocked: { select: { id: true, name: true } } },
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`block:${u.id}`, 20, 3600);
  const v = z
    .object({ userId: z.string(), blocked: z.boolean() })
    .parse(await r.json());
  if (v.userId === u.id) throw new HttpError(422, "You cannot block yourself");
  if (!(await db.user.findFirst({ where: { id: v.userId, deletedAt: null } })))
    throw new HttpError(404, "User unavailable");
  await db.$transaction(async (tx) => {
    if (v.blocked) {
      await tx.userBlock.upsert({
        where: {
          blockerId_blockedId: { blockerId: u.id, blockedId: v.userId },
        },
        create: { blockerId: u.id, blockedId: v.userId },
        update: {},
      });
      await tx.request.updateMany({
        where: {
          OR: [
            {
              userId: u.id,
              project: {
                OR: [
                  { ownerId: v.userId },
                  { owners: { some: { userId: v.userId } } },
                ],
              },
            },
            {
              userId: v.userId,
              project: {
                OR: [{ ownerId: u.id }, { owners: { some: { userId: u.id } } }],
              },
            },
          ],
          status: { in: ["PENDING", "NEEDS_INFO"] },
        },
        data: { status: "CANCELLED" },
      });
    } else
      await tx.userBlock.deleteMany({
        where: { blockerId: u.id, blockedId: v.userId },
      });
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: v.blocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
        targetId: v.userId,
      },
    });
  });
  return Response.json({ ok: true });
});
