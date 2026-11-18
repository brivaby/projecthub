import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { z } from "zod";
import { verifiedVic } from "@/lib/eligibility";
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE"),
    name: z.string().trim().min(2).max(120),
  }),
  z.object({
    action: z.enum(["ADD", "REMOVE"]),
    classId: z.string().min(1),
    userId: z.string().min(1),
  }),
]);
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`course-classes:${u.id}`, 30, 3600);
  const v = input.parse(await r.json());
  if (v.action === "CREATE") {
    const group = await db.classGroup.create({
      data: { courseId: id, name: v.name },
    });
    await db.auditLog.create({
      data: { actorId: u.id, action: "CLASS_CREATED", targetId: group.id },
    });
    return Response.json({ id: group.id }, { status: 201 });
  }
  const group = await db.classGroup.findFirst({
    where: { id: v.classId, courseId: id },
  });
  if (!group) throw new HttpError(404, "Class unavailable");
  if (v.action === "ADD") {
    const member = await db.courseMembership.findUnique({
      where: { courseId_userId: { courseId: id, userId: v.userId } },
      include: { user: true },
    });
    if (member?.status !== "APPROVED" || !verifiedVic(member.user))
      throw new HttpError(422, "Only approved course members may join a class");
    await db.classMember.upsert({
      where: { classId_userId: { classId: v.classId, userId: v.userId } },
      create: { classId: v.classId, userId: v.userId },
      update: {},
    });
  } else
    await db.classMember.deleteMany({
      where: { classId: v.classId, userId: v.userId },
    });
  await db.auditLog.create({
    data: {
      actorId: u.id,
      action: `CLASS_MEMBER_${v.action}`,
      targetId: v.classId,
    },
  });
  return Response.json({ ok: true });
});
