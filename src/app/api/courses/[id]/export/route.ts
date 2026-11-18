import { db } from "@/lib/db";
import { actor, endpoint, limit } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { safeCsv } from "@/lib/education";
export const GET = endpoint(async (r, c) => {
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`course-export:${u.id}`, 10, 3600);
  const rows = await db.submission.findMany({
    where: { assignment: { courseId: id } },
    include: {
      assignment: { select: { title: true, maxScore: true } },
      project: { select: { title: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
  await db.auditLog.create({
    data: { actorId: u.id, action: "COURSE_GRADES_EXPORTED", targetId: id },
  });
  const csv = [
    [
      "Student",
      "Assignment",
      "Project",
      "Status",
      "Grade",
      "Maximum",
      "Private feedback",
    ]
      .map(safeCsv)
      .join(","),
    ...rows.map((s) =>
      [
        s.user.name,
        s.assignment.title,
        s.project.title,
        s.status,
        s.grade,
        s.assignment.maxScore,
        s.feedback,
      ]
        .map(safeCsv)
        .join(","),
    ),
  ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="course-submissions.csv"',
      "Cache-Control": "private, no-store",
    },
  });
});
