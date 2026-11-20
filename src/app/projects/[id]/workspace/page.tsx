import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { canManageProject, assertWorkspaceAccess } from "@/lib/project-access";
import { assertCollaborationEligible } from "@/lib/eligibility";
import { WorkspaceTasks } from "@/components/workspace-tasks";
import { notFound, redirect } from "next/navigation";
import { CollaboratorTools } from "@/components/workspace";
import Link from "next/link";
export default async function Workspace({
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
      collaborators: { include: { user: { select: { name: true } } } },
      files: { select: { id: true, name: true, scanStatus: true } },
      activity: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!p) notFound();
  try {
    await assertCollaborationEligible(u);
    await assertWorkspaceAccess(u, p);
  } catch {
    return (
      <div className="container page">
        <h1 className="page-title">Collaboration workspace</h1>
        <p className="warning">
          Collaboration is currently limited to verified Vine Iternational Christian Academy email
          accounts. An accepted request is required for workspace access.
        </p>
        <Link href="/account" className="button">
          Review account eligibility
        </Link>
      </div>
    );
  }
  const owner = await canManageProject(u, p);
  return (
    <div className="container page">
      <span className="eyebrow">PRIVATE PROJECT WORKSPACE</span>
      <h1 className="page-title">{p.title}</h1>
      <p className="page-subtitle">
        A shared space for approved collaborators. Access is checked on every
        request.
      </p>
      <div className="workspace-nav">
        <Link href={`/projects/${id}`}>Project page</Link>
        {owner && <Link href={`/projects/${id}/edit`}>Manage files</Link>}
        <Link href="/requests">Requests</Link>
      </div>
      <div className="detail-layout">
        <div className="panel">
          <h2>Shared files</h2>
          {p.files.map((f) => (
            <div className="file-row" key={f.id}>
              <span>
                {f.name}
                <small>{f.scanStatus}</small>
              </span>
              <a href={`/api/files/${f.id}`}>Download ↗</a>
            </div>
          ))}
          <WorkspaceTasks projectId={id} />
          <h2 style={{ marginTop: 35 }}>Activity log</h2>
          {p.activity.map((a) => (
            <div className="file-row" key={a.id}>
              <span>{a.kind.replaceAll("_", " ").toLowerCase()}</span>
              <small>{a.createdAt.toLocaleString("en")}</small>
            </div>
          ))}
        </div>
        <aside className="panel">
          <h2>The team</h2>
          {p.collaborators.map((c) => (
            <div key={c.userId} style={{ marginBottom: 25 }}>
              <p>{c.user.name}</p>
              <small>{c.permission}</small>
              {owner && (
                <CollaboratorTools
                  projectId={id}
                  userId={c.userId}
                  permission={c.permission}
                />
              )}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
