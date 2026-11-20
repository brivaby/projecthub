import Link from "next/link";
import {
  ArrowUpRight,
  Eye,
  GitFork,
  Heart,
  Users,
  Bookmark,
  ArrowRight,
  Leaf,
  FlaskConical,
  Code2,
  Palette,
  Globe2,
  Cpu,
  BookOpen,
} from "lucide-react";
import { metrics, type ProjectCardData } from "@/lib/projects";
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: string;
}) {
  return (
    <span className={`avatar ${size}`} aria-hidden="true">
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function Cover({
  kind,
  title,
  large = false,
  imageId,
}: {
  kind: string;
  title: string;
  large?: boolean;
  imageId?: string;
}) {
  if (imageId)
    return (
      <div className={`cover ${large ? "cover-large" : ""}`}>
        <img
          src={`/api/covers/${imageId}`}
          alt={`${title} cover`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  const icons: Record<string, typeof Leaf> = {
    forest: Leaf,
    ocean: Globe2,
    clay: Palette,
    violet: Cpu,
    gold: FlaskConical,
    slate: Code2,
  };
  const Icon = icons[kind] || BookOpen;
  return (
    <div
      className={`cover cover-${kind} ${large ? "cover-large" : ""}`}
      role="img"
      aria-label={`${title} project illustration`}
    >
      <div className="cover-grid" />
      <span className="orbit orbit-one" />
      <span className="orbit orbit-two" />
      <div className="cover-art">
        <Icon strokeWidth={1.1} />
        <span>
          {kind === "forest"
            ? "GROW A BETTER TOMORROW"
            : kind === "ocean"
              ? "CONNECTED BY POSSIBILITY"
              : kind === "violet"
                ? "IDEAS INTO INTELLIGENCE"
                : kind === "gold"
                  ? "A LITTLE CURIOSITY. A BIG DIFFERENCE."
                  : kind === "clay"
                    ? "DESIGNED FOR PEOPLE"
                    : "BUILT TO MAKE A DIFFERENCE"}
        </span>
      </div>
      <span className="cover-label">STUDENT RESEARCH / PROJECTHUB</span>
    </div>
  );
}
export function ProjectCard({
  project: p,
  reason,
  exploreQuery,
}: {
  project: ProjectCardData;
  exploreQuery?: string;
  reason?: string;
}) {
  const m = metrics(p);
  const href = `/projects/${p.id}${exploreQuery !== undefined ? `?${new URLSearchParams({ from: exploreQuery })}` : ""}`;
  return (
    <article className="project-card">
      <Link
        href={href}
        className="card-cover"
      >
        <Cover kind={p.cover} title={p.title} imageId={p.files[0]?.id} />
        <span className="card-arrow">
          <ArrowUpRight size={18} />
          <span className="sr-only">Open {p.title}</span>
        </span>
        {p.featured && <span className="featured-badge">✦ Featured</span>}
      </Link>
      <div className="card-content">
        <div className="card-kicker">
          <span>{p.category.name}</span>
          {p.collaboration !== "CLOSED" && (
            <span className="open-label">
              <i />
              Open to collaborate
            </span>
          )}
        </div>
        <h3>
          <Link href={href}>
            {p.title}
          </Link>
        </h3>
        <p>{p.summary}</p>
        <div className="tags">
          {p.technologies.slice(0, 3).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="card-author">
          <Link href={`/people/${p.owner.id}`}>
            <Avatar name={p.owner.name || "Student"} />
            <span>
              {p.owner.name || "Student"}
              <small>{p.institution.name}</small>
            </span>
          </Link>
          <span className="updated">
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
            }).format(p.updatedAt)}
          </span>
        </div>
        <div className="card-stats">
          <span>
            <Eye />
            {compact(m.views)}
          </span>
          <span>
            <Heart />
            {compact(m.likes)}
          </span>
          <span>
            <GitFork />
            {m.clones}
          </span>
          <span>
            <Users />
            {m.collaborations}
          </span>
          <span className="last">
            <Bookmark />
            {m.bookmarks}
          </span>
        </div>
        <Link className="card-open-link" href={href}>
          View project <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
}
export function compact(n: number) {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
export function Empty({
  title = "A little quiet here",
  text = "Try a different search, or be the first to share a project.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <BookOpen size={36} />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="button secondary" href="/trending">
        Browse projects <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  href,
  link = "View all projects",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link href={href}>
          {link}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
