"use client";
import { useCallback, useEffect, useState } from "react";
import { notificationKinds } from "@/lib/platform-settings";
import { api } from "./actions";
type Kind = (typeof notificationKinds)[number];
type Preference = { kind: Kind; email: boolean; inApp: boolean };
const names: Record<Kind, string> = {
  COLLABORATION: "Collaboration requests and member changes",
  CLONE: "Clone requests and decisions",
  COMMENT: "Comments, replies and comment requests",
  VERSION: "Project versions and releases",
  OWNERSHIP: "Project ownership proposals and transfers",
  FEATURED: "Featured-project announcements",
  REPORT: "Reports and moderation updates",
  SECURITY: "Account security notices",
};
export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preference[]>(
    notificationKinds.map((kind) => ({ kind, email: true, inApp: true })),
  );
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Kind | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = (await api(
        "/api/notification-preferences",
        "GET",
      )) as Preference[];
      setPreferences(
        notificationKinds.map((kind) => {
          const found = rows.find((row) => row.kind === kind);
          return {
            kind,
            email: found?.email !== false,
            inApp: found?.inApp !== false,
          };
        }),
      );
      setReady(true);
    } catch (e) {
      setReady(false);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function change(kind: Kind, channel: "email" | "inApp", value: boolean) {
    setPreferences((current) =>
      current.map((row) =>
        row.kind === kind ? { ...row, [channel]: value } : row,
      ),
    );
    setSaved(null);
  }
  async function save(preference: Preference) {
    setSaving(preference.kind);
    setSaved(null);
    setError("");
    try {
      await api("/api/notification-preferences", "PATCH", preference);
      setSaved(preference.kind);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }
  return (
    <section className="panel" aria-labelledby="notification-preferences-title">
      <h2 id="notification-preferences-title">Choose what reaches you</h2>
      <p className="page-subtitle" style={{ fontSize: 12 }}>
        Manage email and in-app delivery by category. Your overall notification
        switches still apply. New categories default to enabled. Required
        verification and recovery emails may still be sent to keep your account
        secure.
      </p>
      {loading && <p role="status">Loading notification preferences…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        disabled={loading || !!saving}
        onClick={() => void load()}
      >
        Reload preferences
      </button>
      <div style={{ marginTop: 18 }}>
        {preferences.map((preference) => (
          <form
            key={preference.kind}
            onSubmit={(event) => {
              event.preventDefault();
              void save(preference);
            }}
            style={{ borderTop: "1px solid var(--line)", padding: "18px 0" }}
          >
            <fieldset
              disabled={!ready || loading || !!saving}
              style={{ padding: 0, margin: 0, border: 0 }}
            >
              <legend
                style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}
              >
                {names[preference.kind]}
              </legend>
              <div
                style={{
                  display: "flex",
                  gap: 22,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={preference.email}
                    onChange={(event) =>
                      change(preference.kind, "email", event.target.checked)
                    }
                  />
                  Email
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={preference.inApp}
                    onChange={(event) =>
                      change(preference.kind, "inApp", event.target.checked)
                    }
                  />
                  In-app
                </label>
                <button className="button secondary small">
                  {saving === preference.kind
                    ? "Saving…"
                    : "Save this category"}
                </button>
                {saved === preference.kind && (
                  <span role="status" style={{ fontSize: 12 }}>
                    Preferences saved.
                  </span>
                )}
              </div>
            </fieldset>
          </form>
        ))}
      </div>
    </section>
  );
}
type Block = { blocked: { id: string; name: string | null } };
export function BlockedUsers() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBlocks(await api("/api/blocks", "GET"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="panel" aria-labelledby="blocked-users-title">
      <h2 id="blocked-users-title">Blocked accounts</h2>
      <p className="page-subtitle" style={{ fontSize: 12 }}>
        Blocking limits new interactions and cancels relevant pending requests.
        Unblocking allows future interactions; it does not automatically approve
        requests or restore revoked collaboration access.
      </p>
      {loading && <p role="status">Loading blocked accounts…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        disabled={loading || !!pending}
        onClick={() => void load()}
      >
        Reload blocked accounts
      </button>
      {!loading && !error && !blocks.length && (
        <p className="prose">You have not blocked any accounts.</p>
      )}
      {blocks.map(({ blocked }) => (
        <div className="file-row" key={blocked.id}>
          <span>{blocked.name || "Student account"}</span>
          <button
            className="button secondary small"
            disabled={!!pending}
            style={{ marginLeft: "auto" }}
            onClick={async () => {
              if (
                !confirm(
                  `Unblock ${blocked.name || "this account"}? They may be able to send future requests and interact with your public work.`,
                )
              )
                return;
              setPending(blocked.id);
              setMessage("");
              setError("");
              try {
                await api("/api/blocks", "POST", {
                  userId: blocked.id,
                  blocked: false,
                });
                setMessage(
                  "Account unblocked. Previous request decisions are unchanged.",
                );
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending("");
              }
            }}
          >
            {pending === blocked.id ? "Unblocking…" : "Unblock"}
          </button>
        </div>
      ))}
    </section>
  );
}
