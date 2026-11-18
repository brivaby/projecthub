import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ArrowUpRight, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { cardInclude, metrics } from "@/lib/projects";
import { canAccessProject, canManageProject } from "@/lib/project-access";
import {
  collaborationEligible,
  COLLABORATION_RESTRICTION,
} from "@/lib/eligibility";
import { SocialControls } from "@/components/social-controls";
import { Cover, Avatar, ProjectCard, SectionTitle } from "@/components/ui";
import {
  ProjectActions,
  ViewTracker,
  DeleteProject,
  Lifecycle,
  DeleteFile,
  RateProject,
} from "@/components/actions";
import { CommentTools, CollaboratorTools } from "@/components/workspace";
export default async function Project({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await auth();
  const u = s?.user?.id
    ? await db.user.findUnique({ where: { id: s.user.id } })
    : null;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      ...cardInclude,
      files: {
        select: {
          id: true,
          name: true,
          size: true,
          scanStatus: true,
          isCover: true,
          versionId: true,
          version: { select: { status: true } },
        },
      },
      links: true,
      owners: {
        select: { userId: true, user: { select: { id: true, name: true } } },
      },
      versions: {
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          label: true,
          title: true,
          notes: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: "desc" },
      },
      contributors: true,
      collaborators: {
        include: { user: { select: { id: true, name: true } } },
      },
      original: { select: { id: true, title: true, visibility: true } },
      derivatives: {
        where: {
          visibility: "PUBLIC",
          status: "PUBLISHED",
          deletedAt: null,
          archived: false,
        },
        select: { id: true, title: true },
      },
      comments: {
        where: { status: "PUBLIC" },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!p || !(await canAccessProject(u, p, p.collaborators))) notFound();
  if (
    p.ownerId !== u?.id &&
    p.ownerId &&
    p.owner &&
    (await db.user.findFirst({
      where: {
        id: p.ownerId,
        OR: [{ suspended: true }, { deletedAt: { not: null } }],
      },
    })) &&
    u?.role !== "ADMIN"
  )
    notFound();
  const mine = u
    ? await db.engagement.findMany({
        where: { projectId: id, userId: u.id },
        select: { kind: true },
      })
    : [];
  const owner = await canManageProject(u, p);
  const logged = !!u && !u.suspended && !u.deletedAt;
  const m = metrics(p);
  const related = await db.project.findMany({
    where: {
      categoryId: p.categoryId,
      id: { not: id },
      visibility: "PUBLIC",
      status: "PUBLISHED",
      deletedAt: null,
      archived: false,
    },
    include: cardInclude,
    take: 3,
  });
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(d);
  return (
    <div className="container page">
      {p.visibility === "PUBLIC" && <ViewTracker id={id} />}
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/explore">Projects</Link>
        <span>/</span>
        <span>{p.title}</span>
      </nav>
      <div className="detail-layout">
        <div>
          <Cover
            kind={p.cover}
            title={p.title}
            large
            imageId={
              p.files.find((f) => f.isCover && f.scanStatus === "CLEAN"&&(owner||!f.version||f.version.status==='PUBLISHED'))?.id
            }
          />
          <div className="detail-heading">
            <div>
              <span className="eyebrow">
                {p.category.name} · {p.academicLevel}
              </span>
              <h1>{p.title}</h1>
              <p>{p.summary}</p>
            </div>
          </div>
          <Link href={`/people/${p.owner.id}`} className="detail-creator">
            <Avatar name={p.owner.name || "Student"} />
            <span>
              {p.owner.name}
              <small>
                {p.institution.name}
                {p.course && ` · ${p.course.name}`}
              </small>
            </span>
          </Link>
          {owner && (
            <div className="workspace-nav">
              <Link href={`/projects/${id}/edit`}>Edit project</Link>
              <Link href={`/projects/${id}/versions`}>
                Versions & ownership
              </Link>
              <Link href={`/projects/${id}/analytics`}>View analytics</Link>
              <Link href={`/projects/${id}/workspace`}>Private workspace</Link>
            </div>
          )}
          <div className="tags">
            {p.languages.map((l) => (
              <span key={l}>{l}</span>
            ))}
            {p.technologies.map((t) => (
              <span key={t}>{t}</span>
            ))}
            {p.tags.map((t) => (
              <span key={t.tagId}>#{t.tag.name}</span>
            ))}
          </div>
          {p.original && p.original.visibility === "PUBLIC" && (
            <p className="license">
              Built on{" "}
              <Link
                href={`/projects/${p.original.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.original.title} ↗
              </Link>
              . Original creator attribution is preserved.
            </p>
          )}
          <section className="content-section">
            <h2>Project history</h2>
            <p className="prose">
              Status: {p.status.replaceAll("_", " ").toLowerCase()} · Current
              version: {p.versions[0]?.label || "No release yet"}
            </p>
            <Link className="text-button" href={`/projects/${id}/versions`}>
              View versions and release notes →
            </Link>
            {p.owners.map((o) => (
              <p key={o.userId} className="prose">
                Project owner:{" "}
                <Link href={`/people/${o.userId}`}>{o.user.name}</Link>
              </p>
            ))}
          </section>
          <section className="content-section">
            <h2>About the project</h2>
            <div className="prose">{p.description}</div>
          </section>
          {p.links.length > 0 && (
            <section className="content-section">
              <h2>Explore the work</h2>
              <div className="external-links">
                {p.links.map((l) => (
                  <a
                    href={l.url}
                    key={l.id}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {l.kind} <ArrowUpRight size={15} />
                    <span className="sr-only">
                      External link, opens in new tab
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
          <section className="content-section">
            <h2>Project files</h2>
            <p
              className="page-subtitle"
              style={{ fontSize: 11, marginBottom: 15 }}
            >
              File access requires approved collaboration or cloning. Files must
              pass malware scanning before download.
            </p>
            {p.files
              .filter(
                (f) => owner || !f.version || f.version.status === "PUBLISHED",
              )
              .map((f) => (
                <div className="file-row" key={f.id}>
                  <FileText size={20} />
                  <div>
                    {f.name}
                    <small>
                      {(f.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {f.scanStatus === "CLEAN" ? "Scanned" : "Quarantined"}
                    </small>
                  </div>
                  <a href={`/api/files/${f.id}`}>
                    Download <ArrowRight size={12} />
                  </a>
                  {owner && <DeleteFile id={f.id} />}
                </div>
              ))}
            {!p.files.length && (
              <p className="prose">No files have been shared yet.</p>
            )}
          </section>
          {p.contributors.length > 0 && (
            <section className="content-section">
              <h2>Contributors</h2>
              {p.contributors.map((c) => (
                <p key={c.id} className="prose">
                  {c.name} — {c.contribution}
                </p>
              ))}
            </section>
          )}
          <section className="content-section">
            <h2>
              The conversation{" "}
              <span style={{ color: "#94a186" }}>({m.comments})</span>
            </h2>
            {p.comments
              .filter((c) => !c.parentId)
              .map((c) => (
                <article className="comment" key={c.id}>
                  <div className="comment-author">
                    <Avatar name={c.user.name || "Student"} />
                    <Link href={`/people/${c.userId}`}>{c.user.name}</Link>
                    <time>{date(c.createdAt)}</time>
                  </div>
                  <p>{c.body}</p>
                  <CommentTools
                    id={c.id}
                    projectId={id}
                    body={c.body}
                    canEdit={u?.id === c.userId}
                    canDelete={owner || u?.id === c.userId}
                    canReply={logged && !p.commentsApproval}
                  />
                  <div className="comment-replies">
                    {p.comments
                      .filter((x) => x.parentId === c.id)
                      .map((reply) => (
                        <article className="comment" key={reply.id}>
                          <div className="comment-author">
                            <Avatar name={reply.user.name || "Student"} />
                            <Link href={`/people/${reply.userId}`}>
                              {reply.user.name}
                            </Link>
                            <time>{date(reply.createdAt)}</time>
                          </div>
                          <p>{reply.body}</p>
                          <CommentTools
                            id={reply.id}
                            projectId={id}
                            body={reply.body}
                            canEdit={u?.id === reply.userId}
                            canDelete={owner || u?.id === reply.userId}
                            canReply={false}
                          />
                        </article>
                      ))}
                  </div>
                </article>
              ))}
            {!m.comments && (
              <p className="prose">
                Every good idea starts a conversation. Be the first to join in.
              </p>
            )}
          </section>
          {p.derivatives.length > 0 && (
            <section className="content-section">
              <h2>Ideas that grew from this</h2>
              {p.derivatives.map((d) => (
                <p key={d.id}>
                  <Link
                    href={`/projects/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {d.title} ↗
                  </Link>
                </p>
              ))}
            </section>
          )}
        </div>
        <aside>
          <div className="panel">
            <span className="status">
              {p.archived
                ? "ARCHIVED"
                : p.visibility === "PUBLIC"
                  ? "PUBLISHED"
                  : p.visibility}{" "}
              · {p.collaboration}
            </span>
            <div className="detail-stat-grid">
              {[
                ["Views", m.views],
                ["Endorsements", m.likes],
                ["Saves", m.bookmarks],
                ["Clones", m.clones],
                ["Collaborations", m.collaborations],
                ["Comments", m.comments],
              ].map(([l, n]) => (
                <div key={l}>
                  <strong>{n}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <ProjectActions
              id={id}
              license={p.license}
              logged={logged}
              approval={p.commentPolicy === "MODERATED"}
              collaborationEligible={collaborationEligible(u)}
              cloning={p.cloningAllowed}
              collaboration={p.collaboration !== "CLOSED"}
              liked={mine.some((e) => e.kind === "LIKE")}
              saved={mine.some((e) => e.kind === "BOOKMARK")}
            />
            {!collaborationEligible(u) && (
              <p className="collaboration-notice">
                {COLLABORATION_RESTRICTION} Verified students must also accept
                the collaboration rules in account settings.
              </p>
            )}
            <SocialControls userId={p.ownerId} projectId={id} />
            <RateProject
              id={id}
              logged={logged}
              count={p.ratings.length}
              average={
                p.ratings.reduce((sum, r) => sum + r.score, 0) /
                Math.max(1, p.ratings.length)
              }
            />
            <div className="license">
              <strong>License: {p.license}</strong>
              {p.license === "Custom" && (
                <p className="prose">{p.customLicense}</p>
              )}
              <br />
              Respect the license. Give credit to the original creator.
            </div>
            {p.license === "All rights reserved" && (
              <p className="warning">
                Restricted use. Permission from the creator is required before
                copying or redistributing this work.
              </p>
            )}
            <dl className="metadata">
              <div>
                <dt>Published</dt>
                <dd>{date(p.publishedAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{date(p.updatedAt)}</dd>
              </div>
              <div>
                <dt>Project type</dt>
                <dd>{p.projectType}</dd>
              </div>
              <div>
                <dt>Institution</dt>
                <dd>{p.institution.name}</dd>
              </div>
            </dl>
            {owner && (
              <>
                <Lifecycle id={id} archived={p.archived} />
                <DeleteProject id={id} />
              </>
            )}
          </div>
          <div className="panel">
            <h2>Building together</h2>
            {p.collaborators.map((c) => (
              <div key={c.userId} style={{ marginBottom: 15 }}>
                <Link className="detail-creator" href={`/people/${c.userId}`}>
                  <Avatar name={c.user.name || "Student"} />
                  <span>
                    {c.user.name}
                    <small>{c.permission.toLowerCase()}</small>
                  </span>
                </Link>
                {owner && (
                  <CollaboratorTools
                    projectId={id}
                    userId={c.userId}
                    permission={c.permission}
                  />
                )}
              </div>
            ))}
            {!p.collaborators.length && (
              <p className="prose" style={{ fontSize: 12 }}>
                This could be the start of a great team.
              </p>
            )}
          </div>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="section">
          <SectionTitle title="Keep exploring" href="/explore" />
          <div className="project-grid">
            {related.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
