import { admin } from "@/lib/security";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PlatformControls } from "@/components/platform-controls";
import { AdminAction } from "@/components/workspace";
export default async function Admin() {
  try {
    await admin();
  } catch {
    notFound();
  }
  const [users, projects, reports, emails, logs, comments, requests] =
    await Promise.all([
      db.user.findMany({
        select: { id: true, name: true, role: true, suspended: true,emailVerified:true },
        take: 100,
      }),
      db.project.findMany({
        select: {
          id: true,
          title: true,
          visibility: true,
          featured: true,
          archived: true,
        },
        take: 100,
      }),
      db.report.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      db.emailEvent.findMany({
        select: {
          id: true,
          status: true,
          attempts: true,
          createdAt: true,
          error: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      db.comment.findMany({
        select: { id: true, body: true, status: true },
        take: 100,
      }),
      db.request.groupBy({ by: ["type", "status"], _count: { id: true } }),
    ]);
  const [storage,limits,courses,versions]=await Promise.all([db.projectFile.aggregate({_sum:{size:true},_count:{id:true}}),db.rateLimit.findMany({where:{count:{gt:20},expiresAt:{gt:new Date()}},select:{key:true,count:true,expiresAt:true},take:30,orderBy:{count:'desc'}}),db.course.count(),db.projectVersion.count()]);
  const sections = [
    {title:'Storage and course health',rows:[{files:String(storage._count.id),bytes:String(storage._sum.size||0),courses:String(courses),versions:String(versions),backups:'Verify external backup scheduler and restore drills'}]},
    {title:'Rate-limit spikes requiring review',rows:limits.map(l=>({anonymousKey:l.key,count:String(l.count),expires:l.expiresAt.toISOString()}))},
    {
      title: "Users",
      rows: users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        verified: u.emailVerified?'Verified':'Unverified',
        suspended: String(u.suspended),
      })),
    },
    {
      title: "Projects",
      rows: projects.map((p) => ({
        id: p.id,
        title: p.title,
        visibility: p.visibility,
        featured: String(p.featured),
        archived: String(p.archived),
      })),
    },
    {
      title: "Content reports",
      rows: reports.map((r) => ({
        id: r.id,
        target: r.targetId,
        type: r.targetType,
        reason: r.reason,
        status: r.status,
      })),
    },
    {
      title: "Comment moderation",
      rows: comments.map((c) => ({ id: c.id, body: c.body, status: c.status })),
    },
    {
      title: "Email delivery",
      rows: emails.map((e) => ({
        id: e.id,
        status: e.status,
        attempts: String(e.attempts),
        error: e.error || "—",
      })),
    },
    {
      title: "Request statistics",
      rows: requests.map((r) => ({
        type: r.type,
        status: r.status,
        total: String(r._count.id),
      })),
    },
    {
      title: "Audit trail",
      rows: logs.map((l) => ({
        id: l.id,
        actor: l.actorId,
        action: l.action,
        target: l.targetId,
        time: l.createdAt.toISOString(),
      })),
    },
  ];
  return (
    <div className="container page">
      <span className="eyebrow">ADMINISTRATOR WORKSPACE</span>
      <h1 className="page-title">Keep the community thriving.</h1>
      <p className="page-subtitle">
        Moderation, delivery health, and an auditable record of sensitive
        actions. Lists show up to 100 recent records.
      </p>
      <div className="dashboard-stats">
        {[
          ["Users", users.length],
          ["Projects", projects.length],
          ["Open reports", reports.filter((r) => r.status === "OPEN").length],
          ["Failed emails", emails.filter((e) => e.status === "FAILED").length],
        ].map(([l, n]) => (
          <div key={l}>
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <AdminAction /><PlatformControls/>
      {sections.map((section) => (
        <section className="admin-section" key={section.title}>
          <h2>{section.title}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(section.rows[0] || { status: "" }).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j}>{String(v ?? "—")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!section.rows.length && (
              <p className="prose">Nothing to review.</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
