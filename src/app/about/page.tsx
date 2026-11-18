import Link from "next/link";
export const metadata = { title: "Ideas deserve a life beyond the classroom" };
export default function About() {
  return (
    <div className="container page" style={{ maxWidth: 850 }}>
      <span className="eyebrow">ACADEMIC IDEAS. SHARED POSSIBILITIES.</span>
      <h1 className="page-title">
        Good work shouldn’t end
        <br />
        at the deadline.
      </h1>
      <p className="page-subtitle">
        ProjectHub gives student work a place to grow.
      </p>
      <div className="prose">
        We believe the best ideas can come from any classroom, any discipline,
        and any campus. ProjectHub is a public showcase and collaboration
        community for students, teachers, and researchers. Share a project you
        are proud of. Learn from someone working on a different problem. Find a
        collaborator who sees something you missed. Creators stay in control.
        Collaboration and clone requests require approval. Licenses and
        attribution travel with the work. Public profiles never reveal private
        email addresses. Be curious. Give credit. Build something that matters.
      </div>
      <div className="form-actions">
        <Link className="button" href="/upload">
          Share your project ↗
        </Link>
        <Link className="button secondary" href="/community">
          Meet the community
        </Link>
      </div>
    </div>
  );
}
