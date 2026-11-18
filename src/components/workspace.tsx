"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./actions";
export function CommentTools({
  id,
  projectId,
  body,
  canEdit,
  canDelete,
  canReply,
}: {
  id: string;
  projectId: string;
  body: string;
  canEdit: boolean;
  canDelete: boolean;
  canReply: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <div style={{ display: "flex", gap: 12 }}>
        {canReply && (
          <button className="text-button" onClick={() => setMode("reply")}>
            Reply
          </button>
        )}
        {canEdit && (
          <button className="text-button" onClick={() => setMode("edit")}>
            Edit
          </button>
        )}
        {canDelete && (
          <button
            className="text-button"
            onClick={async () => {
              if (!confirm("Remove this comment?")) return;
              try {
                await api(`/api/comments/${id}`, "DELETE");
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Remove
          </button>
        )}
        <button className="text-button" onClick={() => setMode("report")}>
          Report
        </button>
      </div>
      {mode && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            try {
              if (mode === "report")
                await api("/api/reports", "POST", {
                  targetId: id,
                  targetType: "COMMENT",
                  reason: data.get("body"),
                });
              else
                await api(
                  mode === "edit"
                    ? `/api/comments/${id}`
                    : `/api/projects/${projectId}/comments`,
                  mode === "edit" ? "PATCH" : "POST",
                  mode === "edit"
                    ? { body: data.get("body") }
                    : { body: data.get("body"), parentId: id },
                );
              setMode("");
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label className="field">
            {mode === "report"
              ? "Reason for report"
              : mode === "edit"
                ? "Edit comment (may require moderation)"
                : "Your reply"}
            <textarea
              name="body"
              required
              minLength={mode === "report" ? 10 : 2}
              maxLength={4000}
              defaultValue={mode === "edit" ? body : ""}
            />
          </label>
          <div className="form-actions">
            <button className="button small">Submit</button>
            <button
              className="text-button"
              type="button"
              onClick={() => setMode("")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function CollaboratorTools({
  projectId,
  userId,
  permission,
}: {
  projectId: string;
  userId: string;
  permission: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const permission = f.get("permission");
        if (
          permission === "REVOKE" &&
          !confirm("Revoke this collaborator’s project access?")
        )
          return;
        try {
          await api(`/api/projects/${projectId}/collaborators`, "PATCH", {
            userId,
            permission: permission === "REVOKE" ? null : permission,
          });
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <label className="field">
        Access
        <select name="permission" defaultValue={permission}>
          {[
            "VIEWER",
            "COMMENTER",
            "CONTRIBUTOR",
            "EDITOR",
            "MANAGER",
            "REVOKE",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <button className="text-button">Update access</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function AdminAction() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(
            "/api/admin",
            "POST",
            Object.fromEntries(new FormData(e.currentTarget)),
          );
          setMessage("Action recorded");
          router.refresh();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          Action
          <select name="action">
            {[
              "FEATURE",
              "UNFEATURE",
              "HIDE_PROJECT",
              "RESTORE_PROJECT",
              "SUSPEND",
              "UNSUSPEND",
              "HIDE_COMMENT",
              "APPROVE_COMMENT",
              "RESOLVE_REPORT",
              "CATEGORY",
              "TAG",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Target ID (or category/tag name)
          <input name="targetId" required />
        </label>
        <label className="field span-2">
          Reason
          <input name="reason" required minLength={5} maxLength={1000} />
        </label>
      </div>
      <div className="form-actions">
        <button className="button">Apply action</button>
        <span role="status">{message}</span>
      </div>
    </form>
  );
}
