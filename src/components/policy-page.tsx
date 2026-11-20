import Link from "next/link";
export function PolicyPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { title: string; text: string }[];
}) {
  return (
    <div className="container page policy-body">
      <span className="eyebrow">
        VINE ITERNATIONAL CHRISTIAN ACADEMY PROJECTHUB · POLICY VERSION 2026-11-17
      </span>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{intro}</p>
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.text}</p>
        </section>
      ))}
      <section>
        <h2>Questions or concerns</h2>
        <p>
          Use the report action on a project, comment or creator profile to
          submit a concern to the moderation team. Account data controls are
          available in Settings. The school operator must publish its official
          contact details, applicable jurisdiction and retention schedule before
          opening the service publicly.
        </p>
      </section>
      <div className="workspace-nav">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/guidelines">Community guidelines</Link>
        <Link href="/copyright">Copyright</Link>
        <Link href="/cookies">Cookies</Link>
      </div>
    </div>
  );
}
