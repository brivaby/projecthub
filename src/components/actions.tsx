"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Bookmark,
  GitFork,
  Users,
  MessageSquare,
  Share2,
  Flag,
  X,
} from "lucide-react";
export async function api(url: string, method: string, data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.fields?.fieldErrors
        ? Object.entries(result.error.fields.fieldErrors)
            .map(([key, value]) => `${key}: ${(value as string[]).join(", ")}`)
            .join(" · ")
        : result.error?.message || "Something went wrong",
    );
  return result;
}
export function ProjectActions({
  id,
  license,
  logged,
  approval,
  cloning,
  collaboration,
  liked = false,
  saved = false,
  collaborationEligible = false,
}: {
  id: string;
  license: string;
  logged: boolean;
  approval: boolean;
  cloning: boolean;
  collaboration: boolean;
  liked?: boolean;
  saved?: boolean;
  collaborationEligible?: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [likes, setLikes] = useState(liked);
  const [bookmarks, setBookmarks] = useState(saved);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [dialog]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function open(type: string) {
    if (!logged) {
      router.push("/login");
      return;
    }
    if (type === "COLLABORATION" && !collaborationEligible) {
      setToast(
        "Collaboration is currently limited to verified Vic Academy email accounts. Accept collaboration rules in account settings.",
      );
      return;
    }
    setError("");
    setDialog(type);
  }
  async function toggle(kind: "LIKE" | "BOOKMARK") {
    if (!logged) {
      router.push("/login");
      return;
    }
    setBusy(true);
    try {
      const v = await api(`/api/projects/${id}/engagement`, "POST", { kind });
      if (kind === "LIKE") setLikes(v.active);
      else setBookmarks(v.active);
      setToast(
        v.active ? "Saved. Thanks for supporting student work!" : "Removed",
      );
      router.refresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const values = Object.fromEntries(form);
      if (dialog === "REPORT")
        await api("/api/reports", "POST", {
          targetId: id,
          targetType: "PROJECT",
          reason: values.message,
          category: values.category || "GENERAL",
        });
      else if (dialog === "DIRECT")
        await api(`/api/projects/${id}/comments`, "POST", {
          body: values.message,
        });
      else {
        const details = { ...values, licenseAgreed: form.has("licenseAgreed") };
        await api(`/api/projects/${id}/requests`, "POST", {
          type: dialog,
          message: values.message,
          permission: values.permission || "VIEWER",
          details,
        });
      }
      setDialog("");
      setToast(
        dialog === "REPORT"
          ? "Report submitted for review"
          : dialog === "DIRECT"
            ? "Comment published"
            : "Request submitted. You can track it in your workspace.",
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="action-list">
        <button
          className="button"
          onClick={() => open("COLLABORATION")}
          disabled={!collaboration}
        >
          <Users size={16} />
          Request collaboration
        </button>
        <button
          className="button secondary"
          onClick={() => open("CLONE")}
          disabled={!cloning}
        >
          <GitFork size={16} />
          Request to clone
        </button>
        <button
          className="button secondary"
          onClick={() => open(approval ? "COMMENT" : "DIRECT")}
        >
          <MessageSquare size={16} />
          {approval ? "Request to comment" : "Write a comment"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            disabled={busy}
            className="button secondary"
            aria-pressed={likes}
            onClick={() => toggle("LIKE")}
          >
            <Heart size={16} fill={likes ? "currentColor" : "none"} />
            {likes ? "Liked" : "Endorse"}
          </button>
          <button
            disabled={busy}
            className="button secondary"
            aria-pressed={bookmarks}
            onClick={() => toggle("BOOKMARK")}
          >
            <Bookmark size={16} fill={bookmarks ? "currentColor" : "none"} />
            {bookmarks ? "Saved" : "Save"}
          </button>
        </div>
        <button
          className="text-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setToast("Project link copied");
            } catch {
              setToast("Copy the URL from your browser to share this project");
            }
          }}
        >
          <Share2 size={13} />
          Share project
        </button>
        <button className="text-button" onClick={() => open("REPORT")}>
          <Flag size={13} />
          Report this project
        </button>
      </div>
      <dialog
        ref={dialogRef}
        className="modal"
        onCancel={() => setDialog("")}
        onClose={() => setDialog("")}
      >
        <div className="modal-title">
          <h2>
            {dialog === "CLONE"
              ? "Build on this idea"
              : dialog === "COLLABORATION"
                ? "Let’s build together"
                : dialog === "REPORT"
                  ? "Report this project"
                  : "Join the conversation"}
          </h2>
          <button
            aria-label="Close dialog"
            className="modal-close"
            onClick={() => setDialog("")}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          {dialog === "CLONE"
            ? `License: ${license}. Owner approval is required before file access. Attribution must be preserved.`
            : dialog === "COLLABORATION"
              ? "Introduce yourself and tell the creator how you would like to contribute."
              : dialog === "REPORT"
                ? "Tell our moderation team what needs attention."
                : "Share a thoughtful question, suggestion, or piece of feedback."}
        </p>
        <form onSubmit={submit}>
          <div className="form-grid">
            {dialog === "REPORT" && (
              <label className="field span-2">
                Report category
                <select name="category">
                  {[
                    "GENERAL",
                    "COPYRIGHT",
                    "TAKEDOWN",
                    "INTEGRITY",
                    "OWNERSHIP",
                    "HARASSMENT",
                    "MALWARE",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {dialog === "COLLABORATION" && (
              <>
                {[
                  ["skills", "Skills & experience"],
                  ["contribution", "Proposed contribution"],
                  ["responsibilities", "Expected responsibilities"],
                  ["availability", "Your availability"],
                  ["communication", "Preferred communication method"],
                  ["estimatedDuration", "Estimated duration"],
                ].map(([name, label]) => (
                  <label className="field" key={name}>
                    {label}
                    <input name={name} required maxLength={1000} />
                  </label>
                ))}
                <label className="field">
                  Requested access
                  <select name="permission">
                    {[
                      "VIEWER",
                      "COMMENTER",
                      "CONTRIBUTOR",
                      "EDITOR",
                      "MANAGER",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {dialog === "CLONE" && (
              <>
                {[
                  ["reason", "Why would you like to clone this?"],
                  ["intendedUse", "Intended use"],
                  ["modifications", "Planned modifications"],
                  [
                    "attributionPlan",
                    "How will you attribute the original creator?",
                  ],
                ].map(([name, label]) => (
                  <label className="field span-2" key={name}>
                    {label}
                    <textarea name={name} required maxLength={1000} />
                  </label>
                ))}
                <label className="field">
                  Clone visibility
                  <select name="visibility">
                    <option>PRIVATE</option>
                    <option>PUBLIC</option>
                  </select>
                </label>
                <label className="check-field span-2">
                  <input type="checkbox" name="licenseAgreed" required />I agree
                  to respect the {license} license and preserve creator
                  attribution.
                </label>
              </>
            )}
            {dialog === "COMMENT" && (
              <label className="field span-2">
                Optional context
                <input name="context" maxLength={1000} />
              </label>
            )}
            <label className="field span-2">
              {dialog === "REPORT"
                ? "Reason"
                : dialog === "COMMENT" || dialog === "DIRECT"
                  ? "Your comment"
                  : "Message"}
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={4000}
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button" disabled={busy}>
              {busy
                ? "Submitting…"
                : "Submit " +
                  (dialog === "DIRECT"
                    ? "comment"
                    : dialog === "REPORT"
                      ? "report"
                      : "request")}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setDialog("")}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
export function Decision({
  id,
  status,
  owner,
}: {
  id: string;
  status: string;
  owner: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await api(`/api/requests/${id}`, "PATCH", Object.fromEntries(form));
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {(owner || status === "NEEDS_INFO") && (
          <label className="field">
            Response
            <input
              name="response"
              maxLength={2000}
              placeholder="A note for the requester"
            />
          </label>
        )}
        <label className="field">
          Decision
          <select name="status">
            {(owner
              ? status === "ACCEPTED"
                ? ["COMPLETED"]
                : ["ACCEPTED", "REJECTED", "NEEDS_INFO"]
              : status === "NEEDS_INFO"
                ? ["PENDING", "CANCELLED"]
                : ["CANCELLED"]
            ).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button className="button small" disabled={busy}>
          Update request
        </button>
        {error && (
          <span role="alert" className="form-error">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
export function DeleteProject({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="text-button"
        onClick={async () => {
          if (
            !confirm(
              "Delete this project? It will be removed from discovery and public access.",
            )
          )
            return;
          try {
            await api(`/api/projects/${id}`, "DELETE");
            router.push("/dashboard");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Delete project
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    void api(`/api/projects/${id}/views`, "POST", {
      referrer: document.referrer,
    }).catch(() => {});
  }, [id]);
  return null;
}
export function MarkRead() {
  const router = useRouter();
  return (
    <button
      className="button secondary"
      onClick={async () => {
        await api("/api/notifications", "PATCH");
        router.refresh();
      }}
    >
      Mark all as read
    </button>
  );
}

export function Lifecycle({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function act(action: string) {
    if (
      !confirm(
        `${action === "UNPUBLISH" ? "Unpublish" : archived ? "Restore" : "Archive"} this project?`,
      )
    )
      return;
    try {
      await api(`/api/projects/${id}/lifecycle`, "PATCH", { action });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <button
        className="text-button"
        onClick={() => act(archived ? "UNARCHIVE" : "ARCHIVE")}
      >
        {archived ? "Restore project" : "Archive project"}
      </button>
      <button className="text-button" onClick={() => act("UNPUBLISH")}>
        Unpublish project
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function DeleteFile({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="text-button"
        onClick={async () => {
          if (
            !confirm(
              "Remove this file? Upload a new version from the project editor.",
            )
          )
            return;
          try {
            await api(`/api/files/${id}`, "DELETE");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Remove / replace
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
export function RateProject({
  id,
  logged,
  average,
  count,
}: {
  id: string;
  logged: boolean;
  average: number;
  count: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      style={{ marginTop: 20 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!logged) {
          router.push("/login");
          return;
        }
        try {
          await api(`/api/projects/${id}/rating`, "POST", {
            score: Number(new FormData(e.currentTarget).get("score")),
          });
          setMessage("Your rating has been saved");
          router.refresh();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <label className="field">
        Project rating · {count ? average.toFixed(1) : "—"} / 5 ({count})
        <select name="score" defaultValue="5">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <button className="text-button">Submit rating</button>
      <p role="status" style={{ fontSize: 11 }}>
        {message}
      </p>
    </form>
  );
}
