import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { cardInclude } from "@/lib/projects";
import { ProjectCard, Empty } from "@/components/ui";
export default async function Showcase({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collection = await db.courseCollection.findFirst({
    where: { id, public: true, course: { archived: false } },
    include: {
      course: { select: { name: true } },
      projects: {
        where: {
          project: {
            visibility: "PUBLIC",
            status: "PUBLISHED",
            deletedAt: null,
            archived: false,
            owner: { suspended: false, deletedAt: null },
          },
        },
        include: { project: { include: cardInclude } },
      },
    },
  });
  if (!collection) notFound();
  return (
    <div className="container page">
      <span className="eyebrow">VINE ITERNATIONAL CHRISTIAN ACADEMY CLASS SHOWCASE</span>
      <h1 className="page-title">{collection.title}</h1>
      <p className="page-subtitle">
        Public projects from {collection.course.name}. Private grades and
        feedback are never displayed.
      </p>
      {collection.projects.length ? (
        <div className="project-grid">
          {collection.projects.map(({ project }) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <Empty
          title="Ideas are taking shape"
          text="No public projects have been added to this showcase yet."
        />
      )}
    </div>
  );
}
