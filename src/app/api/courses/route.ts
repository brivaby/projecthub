import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { courseInput } from "@/lib/education";
export const GET = endpoint(async () => {
  const u = await actor();
  const courses = await db.course.findMany({
    where: {
      archived: false,
      ...(u.role === "ADMIN"
        ? {}
        : {
            OR: [
              { teacherId: u.id },
              { memberships: { some: { userId: u.id } } },
            ],
          }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      teacherId: true,
      institution: { select: { name: true } },
      memberships: {
        where: { userId: u.id },
        select: { status: true, role: true },
      },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });
  return Response.json(courses, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const u = await actor();
  if (!["TEACHER", "ADMIN"].includes(u.role))
    throw new HttpError(403, "Teacher access required");
  await limit(`course-create:${u.id}`, 10, 3600);
  const v = courseInput.parse(await r.json());
  const course = await db.$transaction(async (tx) => {
    const institution = await tx.institution.upsert({
      where: { name: v.institution },
      create: { name: v.institution },
      update: {},
    });
    const c = await tx.course.create({
      data: {
        name: v.name,
        description: v.description,
        institutionId: institution.id,
        teacherId: u.id,
        memberships: {
          create: { userId: u.id, role: "TEACHER", status: "APPROVED" },
        },
      },
    });
    await tx.auditLog.create({
      data: { actorId: u.id, action: "COURSE_CREATED", targetId: c.id },
    });
    return c;
  });
  return Response.json({ id: course.id }, { status: 201 });
});
