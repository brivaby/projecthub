import Link from "next/link";
import { auth } from "@/auth";
import { DiscoveryControls } from "@/components/discovery-controls";
import { db } from "@/lib/db";
import { discover } from "@/lib/projects";
import { ProjectCard, Empty } from "@/components/ui";
import { licenses } from "@/lib/validation";

export default async function ProjectDiscovery({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = Object.fromEntries(Object.entries(await searchParams).flatMap(([key, value]) =>
    typeof value === "string" && value ? [[key, value] as const] : [],
  ));
  const session = await auth();
  const [data, categories] = await Promise.all([
    discover(params, [], session?.user?.id),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const filterLabels: Record<string, string> = {
    q: "Search", category: "Category", open: "Open to collaborate",
    visibility: "Visibility", clone: "Open for clone requests",
    institution: "Institution", course: "Course", technology: "Technology",
    language: "Programming language", license: "License", level: "Academic level",
    type: "Project type", since: "Published since",
  };
  const activeFilters = Object.entries(filterLabels).filter(([key]) =>
    key === "open" || key === "clone" ? params[key] === "true" : Boolean(params[key]),
  );
  const discoveryQuery = new URLSearchParams(params).toString();
  function page(n: number) {
    const q = new URLSearchParams(params);
    q.set("page", String(n));
    return `/trending?${q}`;
  }
  return (
    <div className="container page">
      <span className="eyebrow">A WORLD OF STUDENT IDEAS</span>
      <h1 className="page-title">Find your next spark.</h1>
      <p className="page-subtitle">Browse projects across disciplines. Find inspiration, or find your next collaborator.</p>
      <DiscoveryControls categories={categories} query={params} signedIn={Boolean(session?.user?.id)} />
      <div className="browse-intents" aria-label="Browse by intent">
        <span>Start with:</span>
        <Link href="/trending?sort=recommended">Recommended</Link>
        <Link href="/trending?sort=newest">Fresh from class</Link>
        <Link href="/trending?open=true">Open to collaborate</Link>
        <Link href="/trending?sort=views">Most viewed</Link>
      </div>
      <form action="/trending" className="filters">
        <input aria-label="Search projects" name="q" defaultValue={params.q} placeholder="Search projects, people, institutions, technologies…" />
        <select aria-label="Category" name="category" defaultValue={params.category || ""}>
          <option value="">All subjects</option>
          {categories.map((c) => <option key={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Sort projects" name="sort" defaultValue={params.sort || "relevance"}>
          {[["relevance", "Relevance & engagement"], ["recommended", "Recommended"], ["views", "Most viewed"], ["clones", "Most cloned"], ["collaborations", "Most collaborated"], ["bookmarks", "Most bookmarked"], ["rated", "Highest rated"], ["newest", "Newest"], ["updated", "Recently updated"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="check-field"><input type="checkbox" name="open" value="true" defaultChecked={params.open === "true"} />Open to collaborate</label>
        <details open={activeFilters.some(([key]) => !["q", "category", "open"].includes(key)) || undefined}>
          <summary>More filters</summary>
          <div className="filter-extra">
            <label>Visibility<select name="visibility" defaultValue={params.visibility || ""}><option value="">All accessible published projects</option><option value="INSTITUTION">Vine Iternational Christian Academy only</option><option value="COURSE">My course projects</option></select></label>
            <label className="check-field"><input type="checkbox" name="clone" value="true" defaultChecked={params.clone === "true"} />Open for clone requests</label>
            {[["institution", "Institution"], ["course", "Course"], ["technology", "Technology"], ["language", "Programming language"]].map(([name, label]) => <label key={name}>{label}<input name={name} defaultValue={params[name]} /></label>)}
            <label>License<select name="license" defaultValue={params.license || ""}><option value="">All licenses</option>{licenses.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Academic level<select name="level" defaultValue={params.level || ""}><option value="">All levels</option>{["Undergraduate", "Postgraduate", "Secondary", "Doctoral", "Other"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Project type<select name="type" defaultValue={params.type || ""}><option value="">All types</option>{["Software", "Research", "Design", "Hardware", "Case study", "Other"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Published since<input type="date" name="since" defaultValue={params.since} /></label>
          </div>
        </details>
        <div className="filter-actions"><button className="button small">Find projects</button><Link className="text-button" href="/trending">Reset filters</Link></div>
      </form>
      <div className="results-toolbar">
        <div className="results-meta" aria-live="polite">{data.total} project{data.total === 1 ? "" : "s"} to browse{params.q && ` for “${params.q}”`}</div>
        <span className="results-hint">Use filters to narrow the field</span>
      </div>
      {activeFilters.length > 0 && <ul className="tags active-filters" aria-label="Active filters">{activeFilters.map(([key, label]) => { const next = new URLSearchParams(params); next.delete(key); next.delete("page"); const value = params[key] === "INSTITUTION" && key === "visibility" ? "Vine Iternational Christian Academy only" : params[key] === "COURSE" && key === "visibility" ? "My course projects" : params[key]; return <li key={key}><Link className="button secondary small" href={next.size ? `/trending?${next}` : "/trending"} aria-label={`Remove ${label} filter`}>{label}{key !== "open" && key !== "clone" && ` · ${value}`} <span aria-hidden="true">×</span></Link></li>; })}</ul>}
      {data.total ? <div className="project-grid">{data.projects.map((p) => <ProjectCard key={p.id} project={p} exploreQuery={discoveryQuery} />)}</div> : <Empty title="No projects found" text="Try broadening your search or clearing a few filters." />}
      <div className="pagination">{data.page > 1 && <Link className="button secondary" href={page(data.page - 1)}>Previous</Link>}<span>Page {data.page} of {Math.max(1, Math.ceil(data.total / 12))}</span>{data.page * 12 < data.total && <Link className="button secondary" href={page(data.page + 1)}>Next</Link>}</div>
    </div>
  );
}
