import { actor } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { notFound, redirect } from "next/navigation";
import { CourseWorkspace } from "@/components/course-tools";
import Link from "next/link";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let user;
  try {
    user = await actor();
  } catch {
    redirect("/login");
  }
  const { id } = await params;
  let course;
  try {
    course = await courseAccess(user, id);
  } catch {
    notFound();
  }
  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/courses">My courses</Link>
        <span>/</span>
        <span>{course.name}</span>
      </nav>
      <span className="eyebrow">YOUR CLASSROOM, CONNECTED</span>
      <h1 className="page-title">{course.name}</h1>
      <p className="page-subtitle">{course.description}</p>
      <CourseWorkspace courseId={id} />
    </div>
  );
}
