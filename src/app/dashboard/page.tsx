import Link from "next/link";
import { redirect } from "next/navigation";
import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { cardInclude } from "@/lib/projects";
import { ProjectCard, Empty } from "@/components/ui";
export default async function Dashboard() {
  let u;
  try {
    u = await actor();
  } catch {
    redirect("/login");
  }
  const [projects, saved, collaborations, requests] = await Promise.all([
    db.project.findMany({
      where: { OR:[{ownerId:u.id},{owners:{some:{userId:u.id}}}], deletedAt: null },
      include: cardInclude,
      orderBy: { updatedAt: "desc" },
    }),
    db.project.findMany({
      where: {
        visibility: "PUBLIC", status:"PUBLISHED",
        deletedAt: null,
        archived: false,
        engagements: { some: { userId: u.id, kind: "BOOKMARK" } },
      },
      include: cardInclude,
    }),
    db.collaborator.findMany({
      where: { userId: u.id },
      include: {
        project: { select: { id: true, title: true, deletedAt: true } },
      },
    }),
    db.request.count({
      where: { project: { OR:[{ownerId:u.id},{owners:{some:{userId:u.id}}}] }, status: "PENDING" },
    }),
  ]);
  return (
    <div className="container page">
      <span className="eyebrow">YOUR LITTLE CORNER OF POSSIBILITY</span>
      <h1 className="page-title">
        Welcome back{u.name ? `, ${u.name.split(" ")[0]}` : ""}.
      </h1>
      <p className="page-subtitle">
        Keep building. Keep sharing. You never know where an idea might lead.
      </p>
      <div className="workspace-nav">
        <Link href="/dashboard">My projects</Link>
        <Link href="/courses">My courses</Link><Link href="/account">Account security</Link>
        <Link href="/requests">Requests ({requests})</Link>
        <Link href="/notifications">Notifications</Link>
        <Link href="/settings">Profile & settings</Link>
        <Link href="/upload">+ New project</Link>
      </div>
      <div className="dashboard-stats">
        {[
          ["Projects", projects.length],
          ["Pending requests", requests],
          ["Saved ideas", saved.length],
          ["Collaborations", collaborations.length],
        ].map(([l, n]) => (
          <div key={l}>
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h2 className="page-title" style={{ fontSize: 28 }}>
        Your projects
      </h2>
      {projects.length ? (
        <div className="project-grid">
          {projects.map((p) => (
            <div key={p.id}>
              <span className="status" style={{ marginBottom: 8 }}>
                {p.visibility}
                {p.archived ? " · ARCHIVED" : ""}
              </span>
              <ProjectCard project={p} />
              <div className="workspace-nav">
                <Link href={`/projects/${p.id}/edit`}>Edit</Link>
                <Link href={`/projects/${p.id}/analytics`}>Analytics</Link>
                <Link href={`/projects/${p.id}/workspace`}>Workspace</Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Make room for your first idea"
          text="Share something you made in class and see where it goes."
        />
      )}
      <section className="section">
        <h2 className="page-title" style={{ fontSize: 28 }}>
          Saved for a little inspiration
        </h2>
        <div className="project-grid">
          {saved.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
      <section className="section">
        <h2 className="page-title" style={{ fontSize: 28 }}>
          Your collaborations
        </h2>
        {collaborations
          .filter((c) => !c.project.deletedAt)
          .map((c) => (
            <div className="file-row" key={c.projectId}>
              <Link href={`/projects/${c.projectId}/workspace`}>
                {c.project.title} →
              </Link>
              <span className="status">{c.permission}</span>
            </div>
          ))}
      </section>
    </div>
  );
}
