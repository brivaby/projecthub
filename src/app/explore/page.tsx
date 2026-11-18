import Link from "next/link";
import { auth } from "@/auth";
import { DiscoveryControls } from "@/components/discovery-controls";
import { db } from "@/lib/db";
import { discover } from "@/lib/projects";
import { ProjectCard, Empty } from "@/components/ui";
import { licenses } from "@/lib/validation";
export const metadata = { title: "Explore projects" };
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const [data, categories] = await Promise.all([
    discover(params, [], session?.user?.id),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  function page(n: number) {
    const q = new URLSearchParams(params);
    q.set("page", String(n));
    return `/explore?${q}`;
  }
  return (
    <div className="container page">
      <span className="eyebrow">A WORLD OF STUDENT IDEAS</span>
      <h1 className="page-title">Find your next spark.</h1>
      <p className="page-subtitle">
        Explore projects across disciplines. Find inspiration, or find your next
        collaborator.
      </p>
      <DiscoveryControls categories={categories} query={params} />
      <form action="/explore" className="filters">
        <input
          aria-label="Search projects"
          name="q"
          defaultValue={params.q}
          placeholder="Search projects, people, institutions, technologies…"
        />
        <select
          aria-label="Category"
          name="category"
          defaultValue={params.category || ""}
        >
          <option value="">All subjects</option>
          {categories.map((c) => (
            <option key={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          aria-label="Sort projects"
          name="sort"
          defaultValue={params.sort || "relevance"}
        >
          {[
            ["relevance", "Relevance & engagement"],
            ["recommended", "Recommended"],
            ["views", "Most viewed"],
            ["clones", "Most cloned"],
            ["collaborations", "Most collaborated"],
            ["bookmarks", "Most bookmarked"],
            ["rated", "Highest rated"],
            ["newest", "Newest"],
            ["updated", "Recently updated"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="check-field">
          <input
            type="checkbox"
            name="open"
            value="true"
            defaultChecked={params.open === "true"}
          />
          Open to collaborate
        </label>
        <details>
          <summary>More filters</summary>
          <div className="filter-extra">
            <label>
              Visibility
              <select name="visibility" defaultValue={params.visibility || ""}>
                <option value="">All accessible published projects</option>
                <option value="INSTITUTION">Vic Academy only</option>
                <option value="COURSE">My course projects</option>
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                name="clone"
                value="true"
                defaultChecked={params.clone === "true"}
              />
              Open for clone requests
            </label>
            {[
              ["institution", "Institution"],
              ["course", "Course"],
              ["technology", "Technology"],
              ["language", "Programming language"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input name={name} defaultValue={params[name]} />
              </label>
            ))}
            <label>
              License
              <select name="license" defaultValue={params.license || ""}>
                <option value="">All licenses</option>
                {licenses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Academic level
              <select name="level" defaultValue={params.level || ""}>
                <option value="">All levels</option>
                {[
                  "Undergraduate",
                  "Postgraduate",
                  "Secondary",
                  "Doctoral",
                  "Other",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Project type
              <select name="type" defaultValue={params.type || ""}>
                <option value="">All types</option>
                {[
                  "Software",
                  "Research",
                  "Design",
                  "Hardware",
                  "Case study",
                  "Other",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Published since
              <input type="date" name="since" defaultValue={params.since} />
            </label>
          </div>
        </details>
        <div className="filter-actions">
          <button className="button small">Find projects</button>
          <Link className="text-button" href="/explore">
            Reset filters
          </Link>
        </div>
      </form>
      <div className="results-meta">
        {data.total} project{data.total === 1 ? "" : "s"} to explore
        {params.q && ` for “${params.q}”`}
      </div>
      {data.total ? (
        <div className="project-grid">
          {data.projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Empty
          title="No projects found"
          text="Try broadening your search or clearing a few filters."
        />
      )}
      <div className="pagination">
        {data.page > 1 && (
          <Link className="button secondary" href={page(data.page - 1)}>
            Previous
          </Link>
        )}
        <span>
          Page {data.page} of {Math.max(1, Math.ceil(data.total / 12))}
        </span>
        {data.page * 12 < data.total && (
          <Link className="button secondary" href={page(data.page + 1)}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
