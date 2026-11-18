import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { z } from "zod";
export const GET = endpoint(async () => {
  const u = await actor();
  const [searches, follows] = await Promise.all([
    db.savedSearch.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.followedCategory.findMany({
      where: { userId: u.id },
      include: { category: true },
    }),
  ]);
  return Response.json(
    { searches, follows },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`discovery:${u.id}`, 20, 3600);
  const v = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("SAVE_SEARCH"),
        name: z.string().trim().min(2).max(100),
        query: z.record(z.string(), z.string().max(300)),
      }),
      z.object({ action: z.literal("DELETE_SEARCH"), id: z.string() }),
      z.object({ action: z.literal("FOLLOW"), categoryId: z.string() }),
      z.object({ action: z.literal("UNFOLLOW"), categoryId: z.string() }),
      z.object({ action: z.literal("CLEAR_HISTORY") }),
    ])
    .parse(await r.json());
  if (v.action === "SAVE_SEARCH") {
    if ((await db.savedSearch.count({ where: { userId: u.id } })) >= 50)
      throw new HttpError(
        422,
        "Remove an old saved search before adding another",
      );
    await db.savedSearch.create({
      data: { userId: u.id, name: v.name, query: v.query },
    });
  } else if (v.action === "DELETE_SEARCH")
    await db.savedSearch.deleteMany({ where: { id: v.id, userId: u.id } });
  else if (v.action === "FOLLOW")
    await db.followedCategory.upsert({
      where: { userId_categoryId: { userId: u.id, categoryId: v.categoryId } },
      create: { userId: u.id, categoryId: v.categoryId },
      update: {},
    });
  else if (v.action === "UNFOLLOW")
    await db.followedCategory.deleteMany({
      where: { userId: u.id, categoryId: v.categoryId },
    });
  else {
    await db.viewHistory.deleteMany({ where: { userId: u.id } });
    await db.recommendation.deleteMany({ where: { userId: u.id } });
  }
  return Response.json({ ok: true });
});
