export default function Loading() {
  return (
    <div className="container page" aria-label="Loading projects" role="status">
      <div className="loading" style={{ height: 60, marginBottom: 25 }} />
      <div className="project-grid">
        {[1, 2, 3].map((n) => (
          <div key={n} className="loading" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
