import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canAccessProject, canManageProject } from "@/lib/project-access";
import {
  VersionPublisher,
  VersionControls,
  OwnershipProposal,
  OwnershipDecision,
} from "@/components/project-lifecycle";
export default async function Versions({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const u = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id } })
    : null;
  const p = await db.project.findUnique({
    where: { id },
    include: { owners: { include: { user: { select: { name: true } } } } },
  });
  if (!p) notFound();
  const manager = await canManageProject(u, p);
  const actualOwner =
    !!u && (p.ownerId === u.id || p.owners.some((o) => o.userId === u.id));
  const invitation = u
    ? await db.ownershipTransfer.findFirst({
        where: {
          projectId: id,
          toUserId: u.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      })
    : null;
  const readable = await canAccessProject(u, p);
  if (!readable && !invitation) notFound();
  const versions = readable
    ? await db.projectVersion.findMany({
        where: { projectId: id, ...(!manager ? { status: "PUBLISHED" } : {}) },
        include: {
          author: { select: { name: true } },
          files: {
            select: { id: true, name: true, size: true, scanStatus: true },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const files = manager
    ? await db.projectFile.findMany({
        where: { projectId: id, scanStatus: "CLEAN", versionId: null },
        select: { id: true, name: true },
      })
    : [];
  const proposals = u
    ? await db.ownershipTransfer.findMany({
        where: {
          projectId: id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
          ...(!manager ? { toUserId: u.id } : {}),
        },
        include: {
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/explore">Projects</Link>
        <span>/</span>
        {readable && <Link href={`/projects/${id}`}>{p.title}</Link>}
        <span>/</span>
        <span>Versions & ownership</span>
      </nav>
      <h1 className="page-title">
        {readable ? p.title : "Project ownership invitation"}
      </h1>
      <p className="page-subtitle">
        Release history preserves the work. Shared ownership preserves the team.
      </p>
      {proposals.map((t) => (
        <article className="request-card" key={t.id}>
          <span className="status">{t.kind} · PENDING</span>
          <h3>
            {t.fromUser.name} → {t.toUser.name}
          </h3>
          <p>
            Expires {t.expiresAt.toLocaleString("en")}. Ownership changes only
            after acceptance.
          </p>
          {u && (u.id === t.toUserId || u.id === t.fromUserId) && (
            <OwnershipDecision
              projectId={id}
              transferId={t.id}
              recipient={u.id === t.toUserId}
            />
          )}
        </article>
      ))}
      {manager && <VersionPublisher projectId={id} files={files} />}
      <h2 className="page-title" style={{ fontSize: 28 }}>
        Release history
      </h2>
      {!versions.length && <p className="prose">No published releases yet.</p>}
      {versions.map((v) => (
        <article className="request-card" key={v.id}>
          <span className="status">
            {v.label} · {v.status}
          </span>
          <h3>{v.title}</h3>
          <small>
            {v.author.name} · {v.createdAt.toLocaleString("en")}
          </small>
          <p>{v.notes}</p>
          {v.files.map((f) => (
            <div className="file-row" key={f.id}>
              <span>
                {f.name}
                <small>
                  {(f.size / 1024).toFixed(1)} KB · {f.scanStatus}
                </small>
              </span>
              <a href={`/api/files/${f.id}`}>Download</a>
            </div>
          ))}
          {manager && (
            <VersionControls
              projectId={id}
              versionId={v.id}
              status={v.status}
            />
          )}
        </article>
      ))}
      {actualOwner && u && (
        <OwnershipProposal projectId={id} primary={p.ownerId === u.id} />
      )}
    </div>
  );
}
