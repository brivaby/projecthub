import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page">
      <div className="empty">
        <span className="eyebrow">404 · A LITTLE OFF THE BEATEN PATH</span>
        <h1 className="page-title">This idea isn’t here.</h1>
        <p>The project may be private, unpublished, or no longer available.</p>
        <Link href="/explore" className="button">
          Explore other projects →
        </Link>
      </div>
    </div>
  );
}
