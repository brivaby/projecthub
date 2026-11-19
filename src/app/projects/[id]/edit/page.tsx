import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { canManageProject } from "@/lib/project-access";
import { notFound, redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let u;
  try {
    u = await actor();
  } catch {
    redirect("/login");
  }
  const { id } = await params;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      category: true,
      institution: true,
      course: true,
      tags: { include: { tag: true } },
      links: true,
      contributors: true,
    },
  });
  if (!p || !(await canManageProject(u, p))) notFound();
  const courses = await db.course.findMany({
    where: {
      archived: false,
      OR: [
        { teacherId: u.id },
        { memberships: { some: { userId: u.id, status: "APPROVED" } } },
      ],
    },
    select: { id: true, name: true, teacherId: true },
  });
  const categories = await db.category.findMany();
  return (
    <div className="container page">
      <h1 className="page-title">Refine your project.</h1>
      <p className="page-subtitle">
        Keep your work and your community up to date.
      </p>
      <ProjectForm
        courses={courses.map(({ id, name, teacherId }) => ({
          id, name, requiresReview: Boolean(teacherId && teacherId !== u.id && u.role !== "ADMIN"),
        }))}
        categories={categories.map((c) => c.name)}
        initial={p}
      />
    </div>
  );
}
