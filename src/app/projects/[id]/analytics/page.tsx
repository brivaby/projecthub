import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { canManageProject } from "@/lib/project-access";
import { cardInclude, metrics } from "@/lib/projects";
import { notFound, redirect } from "next/navigation";
export default async function Analytics({
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
    include: cardInclude,
  });
  if (!p || !await canManageProject(u, p)) notFound();
  const m = metrics(p);
  const days = await db.projectView.groupBy({
    by: ["day"],
    where: { projectId: id },
    _count: { id: true },
    orderBy: { day: "desc" },
    take: 30,
  });
  const totals = await db.projectView.aggregate({
    where: { projectId: id },
    _sum: { totalViews: true },
  });
  const referrals = await db.projectView.groupBy({
    by: ["referrer"],
    where: { projectId: id, referrer: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  const downloads = await db.activity.count({
    where: { projectId: id, kind: "DOWNLOAD" },
  });
  return (
    <div className="container page">
      <span className="eyebrow">VISIBLE ONLY TO YOU AND ADMINISTRATORS</span>
      <h1 className="page-title">See your idea grow.</h1>
      <p className="page-subtitle">
        {p.title} · Counts are deduplicated per visitor per day.
      </p>
      <div className="dashboard-stats">
        {[
          ["Daily unique views", m.views],
          ["Total views", totals._sum.totalViews || 0],
          ["Endorsements", m.likes],
          ["Bookmarks", m.bookmarks],
          ["Comments", m.comments],
          ["Approved clones", m.clones],
          ["Approved collaborations", m.collaborations],
          ["Downloads", downloads],
        ].map(([l, n]) => (
          <div key={l}>
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h2 className="page-title" style={{ fontSize: 28 }}>
        Daily activity
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Unique views</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td>{d._count.id}</td>
                <td>
                  <meter
                    min={0}
                    max={Math.max(1, ...days.map((d) => d._count.id))}
                    value={d._count.id}
                  >
                    {d._count.id}
                  </meter>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="page-title" style={{ fontSize: 28 }}>
        Referral sources
      </h2>
      {referrals.map((r) => (
        <p key={r.referrer} className="prose">
          {r.referrer}: {r._count.id} visits
        </p>
      ))}
    </div>
  );
}
