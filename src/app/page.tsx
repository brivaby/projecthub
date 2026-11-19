import Link from "next/link";
import { auth } from "@/auth";
import { recommendations } from "@/lib/recommendations";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  MoveUpRight,
  Code2,
  Leaf,
  Palette,
  FlaskConical,
  Globe2,
  Briefcase,
  Check,
} from "lucide-react";
import { db } from "@/lib/db";
import { discover, cardInclude } from "@/lib/projects";
import { ProjectCard, SectionTitle, Empty, Avatar } from "@/components/ui";
const subjects = [
  { name: "Computer Science", icon: Code2 },
  { name: "Engineering", icon: FlaskConical },
  { name: "Design & Arts", icon: Palette },
  { name: "Environmental Science", icon: Leaf },
  { name: "Social Sciences", icon: Globe2 },
  { name: "Business", icon: Briefcase },
];
export default async function Home() {
  const session = await auth();
  const recommended = await recommendations(session?.user?.id);
  const recent = await discover({ sort: "newest" });
  const [data, featured, categories, creators, count] = await Promise.all([
    discover(),
    db.project.findMany({
      where: {
        featured: true,
        visibility: "PUBLIC",
        status: "PUBLISHED",
        deletedAt: null,
        archived: false,
      },
      include: cardInclude,
      take: 3,
    }),
    db.category.findMany({
      include: {
        _count: {
          select: {
            projects: {
              where: {
                visibility: "PUBLIC",
                status: "PUBLISHED",
                deletedAt: null,
                archived: false,
              },
            },
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        deletedAt: null,
        suspended: false,
        profile: { public: true, showInRankings: true },
        projects: {
          some: { visibility: "PUBLIC", status: "PUBLISHED", deletedAt: null },
        },
      },
      select: {
        id: true,
        name: true,
        profile: { select: { institution: true } },
        _count: {
          select: {
            projects: {
              where: {
                visibility: "PUBLIC",
                status: "PUBLISHED",
                deletedAt: null,
                archived: false,
              },
            },
          },
        },
      },
      take: 4,
      orderBy: { projects: { _count: "desc" } },
    }),
    db.project.count({
      where: {
        visibility: "PUBLIC",
        status: "PUBLISHED",
        deletedAt: null,
        archived: false,
      },
    }),
  ]);
  return (
    <>
      <section className="hero">
        <div className="container hero-layout">
          <div className="hero-copy">
            <div className="hero-pill">
              <span />
              THE VIC ACADEMY PROJECT SHOWCASE <ArrowUpRight size={14} />
            </div>
            <h1>
              Classroom ideas.
              <br />
              <em>Real-world possibilities.</em>
            </h1>
            <p>
              Discover what Vic Academy students are building. Share your work,
              <br className="desktop-only" /> find your people, and turn a class
              project into something more.
            </p>
            <form action="/trending" className="hero-search">
              <Search size={20} />
              <input
                name="q"
                aria-label="Search projects, topics, or technologies"
                placeholder="Search projects, topics, or technologies…"
              />
              <button>
                Browse projects <ArrowRight size={17} />
              </button>
            </form>
            <div className="hero-popular">
              <span>Popular:</span>
              {[
                "AI & Machine Learning",
                "Sustainability",
                "Web Development",
              ].map((t) => (
                <Link key={t} href={`/trending?q=${encodeURIComponent(t)}`}>
                  {t}
                </Link>
              ))}
            </div>
            <div className="hero-social">
              <div className="avatar-stack">
                {["AN", "JK", "SK", "MR"].map((n) => (
                  <Avatar key={n} name={n} />
                ))}
              </div>
              <span>
                The Vic Academy community.
                <br />
                <strong>{count} projects. Countless possibilities.</strong>
              </span>
              <div className="tiny-stars">✦ ✦ ✦</div>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-ring ring-a" />
            <div className="visual-ring ring-b" />
            <span className="visual-spark">✦</span>
            <div className="float-note note-one">
              <span className="note-icon">
                <Code2 size={20} />
              </span>
              <span>
                Built in class.
                <br />
                <strong>Shared with the world.</strong>
              </span>
              <span className="note-check">
                <Check size={13} />
              </span>
            </div>
            <div className="visual-card">
              <div className="visual-card-top">
                <span className="mini-label">IDEAS THAT MAKE AN IMPACT</span>
                <div className="plant">
                  <span className="plant-stem" />
                  <span className="plant-leaf l1" />
                  <span className="plant-leaf l2" />
                  <span className="plant-leaf l3" />
                  <span className="plant-leaf l4" />
                  <div className="plant-pot" />
                </div>
                <span className="visual-coordinate">01 / THE NEXT CHAPTER</span>
              </div>
              <div className="visual-card-bottom">
                <span>ENVIRONMENTAL SCIENCE</span>
                <h3>Small ideas. Lasting impact.</h3>
                <p>A greener future starts with a little curiosity.</p>
                <div>
                  <Avatar name="Amara N" />
                  <span>By the next generation of makers</span>
                  <MoveUpRight size={17} />
                </div>
              </div>
            </div>
            <div className="float-note note-two">
              <span className="note-icon peach">
                <Globe2 size={21} />
              </span>
              <span>
                Different disciplines.
                <br />
                <strong>One Vic Academy community.</strong>
              </span>
            </div>
            <div className="visual-sticker">
              Made to
              <br />
              <em>make a difference.</em>
              <span>↗</span>
            </div>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <div className="container">
          <span>BIG IDEAS START AT VIC ACADEMY</span>
          <span>For students</span>
          <i>✦</i>
          <span>For educators</span>
          <i>✦</i>
          <span>For curious minds</span>
          <i>✦</i>
          <span>For a better tomorrow</span>
        </div>
      </section>
      <section className="container section journey-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A SIMPLE PATH FROM IDEA TO IMPACT</span>
            <h2>Make something meaningful of your next idea.</h2>
          </div>
          <p>
            ProjectHub helps Vic Academy students move beyond the deadline —
            whether you are looking for inspiration, feedback, or a team.
          </p>
        </div>
        <div className="journey-grid">
          <Link className="journey-card" href="/trending">
            <span className="journey-number">01</span>
            <Search size={22} />
            <h3>Find a spark</h3>
            <p>Browse real student work by subject, technology, or what is gaining momentum.</p>
            <span className="journey-link">Browse projects <ArrowRight size={15} /></span>
          </Link>
          <Link className="journey-card" href="/upload">
            <span className="journey-number">02</span>
            <ArrowUpRight size={22} />
            <h3>Share your work</h3>
            <p>Give a class project a home where its process, files, and progress can be discovered.</p>
            <span className="journey-link">Share a project <ArrowRight size={15} /></span>
          </Link>
          <Link className="journey-card" href="/community">
            <span className="journey-number">03</span>
            <Globe2 size={22} />
            <h3>Build together</h3>
            <p>Meet curious people, start a conversation, and turn a promising idea into a team effort.</p>
            <span className="journey-link">Meet the community <ArrowRight size={15} /></span>
          </Link>
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          eyebrow="A LITTLE INSPIRATION GOES A LONG WAY"
          title="Worth a closer look"
          href="/trending?sort=recommended"
        />
        <div className="project-grid">
          {featured.length
            ? featured.map((p) => <ProjectCard key={p.id} project={p} />)
            : data.projects
                .slice(0, 3)
                .map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
        {!data.total && (
          <Empty
            title="Your next big idea belongs here"
            text="ProjectHub is ready for its first published projects. Share yours to start the community."
          />
        )}
      </section>
      <section className="container section explore-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              DISCOVER. GET INSPIRED. BUILD TOGETHER.
            </span>
            <h2>
              Find your next spark<span className="heading-dot">.</span>
            </h2>
          </div>
          <p>
            From first experiments to big breakthroughs.
            <br />
            There’s a project for every kind of curious.
          </p>
        </div>
        <div className="category-tabs">
            <Link className="selected" href="/trending">
            All projects
          </Link>
          {subjects.slice(0, 5).map((s) => (
            <Link
              href={`/trending?category=${encodeURIComponent(s.name)}`}
              key={s.name}
            >
              <s.icon size={15} />
              {s.name}
            </Link>
          ))}
          <Link href="/categories" className="all-categories">
            More <ArrowRight size={15} />
          </Link>
        </div>
        <div className="explore-toolbar">
          <span>
            <span className="green-dot" /> Explore what’s happening in the
            community
          </span>
          <Link href="/trending">Trending this week ↗</Link>
        </div>
        <div className="project-grid">
          {data.projects.slice(0, 6).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
        <div className="center">
          <Link className="button secondary" href="/trending">
            Browse all projects <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          eyebrow="FIND YOUR OWN PATH THROUGH THE COMMUNITY"
          title="A different way to discover"
        />
        <div className="workspace-nav">
          {[
            ["views", "Most viewed"],
            ["clones", "Most cloned"],
            ["collaborations", "Most collaborated"],
            ["bookmarks", "Most bookmarked"],
            ["rated", "Most endorsed"],
          ].map(([sort, label]) => (
            <Link key={sort} href={`/trending?sort=${sort}`}>
              {label} ↗
            </Link>
          ))}
        </div>
        <SectionTitle
          title="Picked for your curiosity"
          href="/trending?sort=recommended"
        />
        <div className="project-grid">
          {recommended.projects.slice(0, 3).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          title="Fresh from the classroom"
          href="/trending?sort=newest"
        />
        <div className="project-grid">
          {recent.projects.slice(0, 3).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
      <section className="category-section">
        <div className="container section">
          <SectionTitle
            eyebrow="MANY DISCIPLINES. ENDLESS POSSIBILITIES."
            title="Follow your curiosity"
            href="/categories"
            link="All categories"
          />
          <div className="subject-grid">
            {subjects.map((s) => (
              <Link
                key={s.name}
                href={`/trending?category=${encodeURIComponent(s.name)}`}
              >
                <s.icon />
                <h3>{s.name}</h3>
                <span>
                  {categories.find((c) => c.name === s.name)?._count.projects ||
                    0}{" "}
                  projects <ArrowUpRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          eyebrow="MEET THE MINDS BEHIND THE WORK"
          title="People making things happen"
          href="/community"
          link="Meet the community"
        />
        <div className="creator-grid">
          {creators.map((u, i) => (
            <Link key={u.id} href={`/people/${u.id}`}>
              <span className={`creator-avatar color-${i}`}>
                <Avatar name={u.name || "Student"} />
              </span>
              <h3>{u.name}</h3>
              <p>{u.profile?.institution}</p>
              <span>
                {u._count.projects} published projects{" "}
                <ArrowUpRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="container">
        <div className="share-banner">
          <div>
            <span className="eyebrow">
              YOUR WORK COULD BE SOMEONE’S NEXT INSPIRATION
            </span>
            <h2>
              You made something.
              <br />
              Let the world see it.
            </h2>
            <p>Give your class project a life beyond the deadline.</p>
            <Link className="button light" href="/upload">
              Share your project <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="banner-art" aria-hidden="true">
            <span>✳</span>
            <div>
              Great things
              <br />
              start with
              <br />
              <em>“what if?”</em>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
