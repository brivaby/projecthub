"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./actions";
export function DiscoveryControls({
  categories,
  query,
  signedIn,
}: {
  categories: { id: string; name: string }[];
  query: Record<string, string>;
  signedIn: boolean;
}) {
  const [searches, setSearches] = useState<
    { id: string; name: string; query: Record<string, string> }[]
  >([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  async function refresh() {
    setLoadState("loading");
    try {
      const data = await api("/api/discovery", "GET");
      setSearches(data.searches);
      setFollowed(
        data.follows.map((f: { categoryId: string }) => f.categoryId),
      );
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }
  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn]);
  if (!signedIn) {
    return <Link href="/login">Sign in to save searches and follow subjects</Link>;
  }
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
      {loadState === "loading" && <p role="status">Loading saved searches…</p>}
      {loadState === "error" && (
        <p role="alert">
          Could not load saved searches.{" "}
          <button type="button" className="text-button" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      )}
      {loadState === "ready" && searches.length === 0 && <p>No saved searches yet.</p>}
      {searches.map((s) => (
        <div className="file-row" key={s.id}>
          <Link href={`/trending?${new URLSearchParams(s.query)}`}>
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
    </details>
  );
}
