import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { verifiedVic } from "@/lib/eligibility";
import Link from "next/link";
import { ProjectForm } from "@/components/project-form";
export const metadata = { title: "Share your project" };
export default async function Upload() {
  let user;
  try {
    user = await actor();
  } catch {
    redirect("/login");
  }
  if (!verifiedVic(user))
    return (
      <div className="container page">
        <h1 className="page-title">A home for Vic Academy projects.</h1>
        <p className="page-subtitle">
          Publishing is available to verified @vicacademy.org accounts. You can
          still discover, endorse, bookmark, comment on, and request to clone
          public projects.
        </p>
        <Link href="/settings" className="button">
          Manage your account
        </Link>
      </div>
    );
  const courses = await db.course.findMany({
    where: {
      archived: false,
      OR: [
        { teacherId: user.id },
        { memberships: { some: { userId: user.id, status: "APPROVED" } } },
      ],
    },
    select: { id: true, name: true },
  });
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="container page">
      <div style={{ maxWidth: 850, margin: "auto" }}>
        <span className="eyebrow">
          GIVE YOUR IDEA A LIFE BEYOND THE CLASSROOM
        </span>
        <h1 className="page-title">Share what you’re building.</h1>
        <p className="page-subtitle">
          Every project starts somewhere. Tell us about yours.
        </p>
      </div>
      <ProjectForm
        courses={courses}
        categories={categories.map((c) => c.name)}
      />
    </div>
  );
}
