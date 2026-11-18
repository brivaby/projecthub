import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { canTeachCourse } from "@/lib/education";
import { z } from "zod";
import { canAccessProject } from "@/lib/project-access";
export const GET = endpoint(async (r, c) => {
  const u = await actor();
  const { id } = await c.params;
  const course = await courseAccess(u, id);
  const teacher = canTeachCourse(u, course, course.memberships);
  const [assignments, memberships, classes, collections] = await Promise.all([
    db.assignment.findMany({
      where: { courseId: id },
      include: {
        submissions: {
          where: teacher ? {} : { userId: u.id },
          select: {
            id: true,
            projectId: true,
            userId: true,
            status: true,
            grade: true,
            feedback: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.courseMembership.findMany({
      where: { courseId: id, ...(teacher ? {} : { userId: u.id }) },
      select: {
        userId: true,
        status: true,
        role: true,
        user: { select: { name: true } },
      },
    }),
    db.classGroup.findMany({
      where: { courseId: id },
      include: {
        members: {
          where: teacher ? {} : { userId: u.id },
          select: { userId: true },
        },
      },
    }),
    db.courseCollection.findMany({
      where: { courseId: id },
      include: { projects: { include: { project: true } } },
      take: 100,
    }),
  ]);
  const visibleCollections = await Promise.all(
    collections.map(async (collection) => {
      const projects = [];
      for (const item of collection.projects) {
        const project = item.project;
        if (project.deletedAt || project.archived) continue;
        if (
          collection.public &&
          (project.visibility !== "PUBLIC" || project.status !== "PUBLISHED")
        )
          continue;
        if (!(await canAccessProject(u, project))) continue;
        projects.push({
          project: {
            id: project.id,
            title: project.title,
            summary: project.summary,
          },
        });
      }
      return {
        id: collection.id,
        title: collection.title,
        public: collection.public,
        projects,
      };
    }),
  );
  return Response.json(
    {
      course: {
        id: course.id,
        name: course.name,
        description: course.description,
        teacherId: course.teacherId,
      },
      teacher,
      assignments,
      memberships,
      classes,
      collections: visibleCollections,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`course-edit:${u.id}`, 30);
  const v = z
    .object({
      name: z.string().trim().min(3).max(160),
      description: z.string().max(5000),
      archived: z.boolean().default(false),
    })
    .parse(await r.json());
  await db.$transaction([
    db.course.update({ where: { id }, data: v }),
    db.auditLog.create({
      data: {
        actorId: u.id,
        action: v.archived ? "COURSE_ARCHIVED" : "COURSE_UPDATED",
        targetId: id,
      },
    }),
  ]);
  return Response.json({ ok: true });
});
