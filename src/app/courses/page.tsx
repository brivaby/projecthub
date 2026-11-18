import Link from "next/link";
import { redirect } from "next/navigation";
import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { CreateCourse, JoinCourse } from "@/components/course-tools";
export const metadata = { title: "My courses · Vic Academy ProjectHub" };
export default async function Courses() {
  let user;
  try {
    user = await actor();
  } catch {
    redirect("/login");
  }
  const courses = await db.course.findMany({
    where: {
      archived: false,
      ...(user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { teacherId: user.id },
              { memberships: { some: { userId: user.id } } },
            ],
          }),
    },
    include: {
      institution: { select: { name: true } },
      memberships: { where: { userId: user.id }, select: { status: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <div className="container page">
      <span className="eyebrow">LEARN, BUILD, REFLECT</span>
      <h1 className="page-title">Your courses.</h1>
      <p className="page-subtitle">
        Assignments, class projects, and thoughtful feedback from your teachers.
      </p>
      <div className="project-grid" style={{ marginBottom: 35 }}>
        {courses.map((course) => (
          <article className="panel" key={course.id}>
            <span className="status">
              {course.teacherId === user.id
                ? "TEACHER"
                : course.memberships[0]?.status || "ADMIN"}
            </span>
            <h2 style={{ marginTop: 15 }}>{course.name}</h2>
            <p className="prose" style={{ fontSize: 12 }}>
              {course.description}
            </p>
            <small>
              {course.institution.name} · {course._count.assignments}{" "}
              assignments
            </small>
            <div className="form-actions">
              <Link className="button secondary" href={`/courses/${course.id}`}>
                Open course →
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!courses.length && (
        <p className="prose" style={{ marginBottom: 30 }}>
          No courses yet. Your teacher can invite your verified Vic Academy
          account.
        </p>
      )}
      <JoinCourse />
      {["TEACHER", "ADMIN"].includes(user.role) && <CreateCourse />}
    </div>
  );
}
