import Link from "next/link";
import { admin } from "@/lib/security";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

type ViewRow = {
  projectId: string;
  day: string;
  referrer: string | null;
  totalViews: number;
  createdAt: Date;
  project: { title: string };
};

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

export default async function StatsPage() {
  try {
    await admin();
  } catch {
    notFound();
  }

  const rows = (await db.projectView.findMany({
    select: {
      projectId: true,
      day: true,
      referrer: true,
      totalViews: true,
      createdAt: true,
      project: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20000,
  })) as ViewRow[];

  const totalVisits = rows.reduce((sum, row) => sum + row.totalViews, 0);
  const uniqueDailyVisitors = rows.length;
  const projectTotals = new Map<string, { title: string; visits: number }>();
  const dayTotals = new Map<string, number>();
  const sourceTotals = new Map<string, number>();
  const hourTotals = new Map<number, number>();

  for (const row of rows) {
    const project = projectTotals.get(row.projectId) || {
      title: row.project.title,
      visits: 0,
    };
    project.visits += row.totalViews;
    projectTotals.set(row.projectId, project);
    dayTotals.set(row.day, (dayTotals.get(row.day) || 0) + row.totalViews);
    const source = row.referrer || "Direct / typed link";
    sourceTotals.set(source, (sourceTotals.get(source) || 0) + row.totalViews);
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hour12: false,
        timeZone: "Africa/Kampala",
      }).format(row.createdAt),
    );
    hourTotals.set(hour, (hourTotals.get(hour) || 0) + row.totalViews);
  }

  const projects = [...projectTotals.values()]
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8);
  const days = [...dayTotals.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10);
  const sources = [...sourceTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const peakHour = [...hourTotals.entries()].sort(([, a], [, b]) => b - a)[0];
  const peakDay = days[0];

  return (
    <div className="container page stats-page">
      <div className="stats-hero">
        <div>
          <span className="eyebrow">PROJECTHUB INSIGHTS · ADMIN ONLY</span>
          <h1 className="page-title">See what gets people curious.</h1>
          <p className="page-subtitle">
            A simple view of what students and visitors are exploring. Counts
            are aggregated and daily visitor identities are never shown.
          </p>
        </div>
        <div className="stats-hero-note">
          <span>Reporting window</span>
          <strong>Available history</strong>
          <small>Timezone: Africa/Kampala</small>
        </div>
      </div>

      <div className="dashboard-stats stats-kpis">
        {[
          ["Total visits", totalVisits.toLocaleString()],
          ["Daily visitor records", uniqueDailyVisitors.toLocaleString()],
          ["Projects visited", projectTotals.size.toLocaleString()],
          ["Top project", projects[0]?.title || "No visits yet"],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="stats-grid">
        <section className="stats-panel stats-panel-wide">
          <div className="stats-panel-heading">
            <div>
              <span className="eyebrow">MOST VISITED</span>
              <h2>Projects drawing attention</h2>
            </div>
            <span className="stats-caption">{totalVisits.toLocaleString()} total visits</span>
          </div>
          {projects.length ? (
            <div className="stats-ranking">
              {projects.map((project, index) => (
                <div className="stats-ranking-row" key={project.title}>
                  <span className="stats-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div className="stats-ranking-main">
                    <strong>{project.title}</strong>
                    <span>{project.visits.toLocaleString()} visits</span>
                    <div className="stats-bar"><i style={{ width: `${percent(project.visits, projects[0].visits)}%` }} /></div>
                  </div>
                  <b>{percent(project.visits, totalVisits)}%</b>
                </div>
              ))}
            </div>
          ) : <p className="prose">No project visits have been recorded yet.</p>}
        </section>

        <section className="stats-panel stats-panel-highlight">
          <span className="eyebrow">THE QUICK READ</span>
          <h2>When people show up</h2>
          <div className="stats-highlight-number">{peakHour ? formatHour(peakHour[0]) : "—"}</div>
          <p>is the busiest visit hour in Kampala time.</p>
          <div className="stats-highlight-rule" />
          <strong>{peakDay ? `${peakDay[0]} · ${peakDay[1].toLocaleString()} visits` : "No peak day yet"}</strong>
          <p>is the strongest recorded day.</p>
        </section>

        <section className="stats-panel">
          <div className="stats-panel-heading"><div><span className="eyebrow">DISCOVERY PATHS</span><h2>Where visitors come from</h2></div></div>
          {sources.length ? sources.map(([source, visits]) => (
            <div className="stats-source" key={source}><div><strong>{source}</strong><span>{visits.toLocaleString()} visits</span></div><b>{percent(visits, totalVisits)}%</b></div>
          )) : <p className="prose">Referrer data will appear after the first visits.</p>}
        </section>

        <section className="stats-panel">
          <div className="stats-panel-heading"><div><span className="eyebrow">RECENT MOMENTUM</span><h2>Visits by day</h2></div><span className="stats-caption">Last 10 recorded days</span></div>
          <div className="stats-days">
            {days.length ? days.map(([day, visits]) => <div className="stats-day" key={day}><span>{day}</span><i><b style={{ width: `${percent(visits, Math.max(...days.map(([, count]) => count)))}%` }} /></i><strong>{visits}</strong></div>) : <p className="prose">Daily activity will appear here.</p>}
          </div>
        </section>
      </div>

      <p className="stats-footnote">Analytics use aggregated ProjectView records. Referrer values are hostnames only; no raw visitor identity or private account data is displayed.</p>
      <Link className="button secondary" href="/admin">Back to admin workspace</Link>
    </div>
  );
}
