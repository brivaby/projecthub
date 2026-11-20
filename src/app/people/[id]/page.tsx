import { verifiedVic } from "@/lib/eligibility";
import { SocialControls } from "@/components/social-controls";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { cardInclude } from "@/lib/projects";
import { Avatar, ProjectCard, Empty } from "@/components/ui";
export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await db.user.findFirst({
    where: { id, suspended: false, deletedAt: null, profile: { public: true } },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      suspended: true,
      deletedAt: true,
      profile: true,
      projects: {
        where: {
          visibility: "PUBLIC",
          status: "PUBLISHED",
          deletedAt: null,
          archived: false,
        },
        include: cardInclude,
      },
      collaborators: {
        where: {
          project: {
            visibility: "PUBLIC",
            status: "PUBLISHED",
            deletedAt: null,
            archived: false,
          },
        },
        select: { project: { select: { id: true, title: true } } },
      },
    },
  });
  if (!user) notFound();
  return (
    <div className="container page">
      <div className="profile-hero">
        <Avatar name={user.name || "Student"} />
        <div>
          <span className="eyebrow">MEET THE CREATOR</span>
          <h1 className="page-title">{user.name}</h1>
          <p>
            {user.profile?.showInstitution
              ? user.profile.institution
              : undefined}
            {user.profile?.showDomainBadge && verifiedVic(user)
              ? " · Verified Vine Iternational Christian Academy"
              : undefined}
          </p>
        </div>
      </div>
      <SocialControls userId={id} />
      <div className="prose" style={{ maxWidth: 750 }}>
        {user.profile?.bio}
      </div>
      <div className="tags">
        {[
          ...(user.profile?.skills || []),
          ...(user.profile?.technologies || []),
        ].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      <div className="external-links">
        {user.profile?.links.map((link, i) => (
          <a
            key={link}
            href={link}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            Social link {i + 1} ↗
          </a>
        ))}
      </div>
      <section className="section">
        <h2 className="page-title" style={{ fontSize: 29 }}>
          Ideas shared with the world
        </h2>
        {user.projects.length ? (
          <div className="project-grid">
            {user.projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Empty
            title="Something good is in the works"
            text="This creator hasn’t published any projects yet."
          />
        )}
      </section>
      {user.profile?.showCollaborations && user.collaborators.length > 0 && (
        <section className="section">
          <h2 className="page-title" style={{ fontSize: 29 }}>
            Public collaborations
          </h2>
          {user.collaborators.map((c) => (
            <p key={c.project.id} className="prose">
              <a
                href={`/projects/${c.project.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.project.title} ↗
              </a>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
