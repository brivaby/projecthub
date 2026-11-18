"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./actions";
export function DiscoveryControls({
  categories,
  query,
}: {
  categories: { id: string; name: string }[];
  query: Record<string, string>;
}) {
  const [searches, setSearches] = useState<
    { id: string; name: string; query: Record<string, string> }[]
  >([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      const data = await api("/api/discovery", "GET");
      setSearches(data.searches);
      setFollowed(
        data.follows.map((f: { categoryId: string }) => f.categoryId),
      );
    } catch {}
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <details className="panel">
      <summary>Saved searches & followed subjects</summary>
      <form
        className="follow-actions"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/api/discovery", "POST", {
              action: "SAVE_SEARCH",
              name: new FormData(e.currentTarget).get("name"),
              query,
            });
            setMessage("Search saved");
            await refresh();
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label className="field">
          Save this search
          <input name="name" required minLength={2} maxLength={100} />
        </label>
        <button className="button small">Save search</button>
      </form>
      {searches.map((s) => (
        <div className="file-row" key={s.id}>
          <Link href={`/explore?${new URLSearchParams(s.query)}`}>
            {s.name}
          </Link>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api("/api/discovery", "POST", {
                  action: "DELETE_SEARCH",
                  id: s.id,
                });
                await refresh();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="tags">
        {categories.map((c) => (
          <button
            className="button secondary small"
            aria-pressed={followed.includes(c.id)}
            key={c.id}
            onClick={async () => {
              try {
                await api("/api/discovery", "POST", {
                  action: followed.includes(c.id) ? "UNFOLLOW" : "FOLLOW",
                  categoryId: c.id,
                });
                await refresh();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            {followed.includes(c.id) ? "✓ " : ""}
            {c.name}
          </button>
        ))}
      </div>
      <p role="status">{message}</p>
      <p className="prose" style={{ fontSize: 11 }}>
        Sign in to save searches and follow subjects.
      </p>
    </details>
  );
}
