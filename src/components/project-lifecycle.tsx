"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./actions";
export function VersionPublisher({
  projectId,
  files,
}: {
  projectId: string;
  files: { id: string; name: string }[];
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget;
        const f = new FormData(form);
        try {
          await api(`/api/projects/${projectId}/versions`, "POST", {
            label: f.get("label"),
            title: f.get("title"),
            notes: f.get("notes"),
            status: f.get("status"),
            fileIds: f.getAll("fileIds"),
          });
          router.refresh();
          form.reset();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Create a project version</h2>
      <div className="form-grid">
        <label className="field">
          Version label
          <input
            name="label"
            required
            maxLength={40}
            pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*"
            placeholder="1.0.0"
          />
        </label>
        <label className="field">
          Release title
          <input name="title" required minLength={3} maxLength={140} />
        </label>
        <label className="field span-2">
          Release notes
          <textarea name="notes" required minLength={10} maxLength={10000} />
        </label>
        <label className="field">
          Release status
          <select name="status">
            <option value="DRAFT">Draft — owners only</option>
            <option value="PUBLISHED">
              Published — project visibility applies
            </option>
          </select>
        </label>
        <fieldset className="span-2">
          <legend>Clean files not assigned to an earlier release</legend>
          {files.length ? (
            files.map((f) => (
              <label className="check-field" key={f.id}>
                <input type="checkbox" name="fileIds" value={f.id} />
                {f.name}
              </label>
            ))
          ) : (
            <p className="prose">
              Upload and scan project files first, or publish a
              documentation-only version.
            </p>
          )}
        </fieldset>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy} style={{ marginTop: 20 }}>
        {busy ? "Saving…" : "Save version"}
      </button>
    </form>
  );
}
export function VersionControls({
  projectId,
  versionId,
  status,
}: {
  projectId: string;
  versionId: string;
  status: string;
}) {
  const [error, setError] = useState("");
  const router = useRouter();
  async function action(action: string) {
    if (
      action === "RESTORE" &&
      !confirm(
        "Restore this content as a new draft version? Visibility, ownership, permissions, and existing releases are preserved.",
      )
    )
      return;
    try {
      await api(`/api/projects/${projectId}/versions`, "PATCH", {
        versionId,
        action,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div>
      <div className="form-actions">
        {status === "DRAFT" && (
          <button className="text-button" onClick={() => action("PUBLISH")}>
            Publish version
          </button>
        )}
        {status !== "ARCHIVED" && (
          <button className="text-button" onClick={() => action("ARCHIVE")}>
            Archive version
          </button>
        )}
        <button className="text-button" onClick={() => action("RESTORE")}>
          Restore content as draft
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function OwnershipProposal({
  projectId,
  primary,
}: {
  projectId: string;
  primary: boolean;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        try {
          await api(`/api/projects/${projectId}/ownership`, "POST", {
            email: f.get("email"),
            kind: f.get("kind"),
          });
          setMessage(
            "Proposal sent. The recipient must accept before ownership changes.",
          );
          router.refresh();
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>Shared ownership</h2>
      <p className="page-subtitle">
        Invite an eligible verified Vine Iternational Christian Academy co-owner. A primary ownership
        transfer requires both parties to confirm; existing owners retain
        attribution and shared ownership.
      </p>
      <div className="form-grid">
        <label className="field">
        Vine Iternational Christian Academy account email
          <input name="email" type="email" required maxLength={254} />
        </label>
        <label className="field">
          Proposal
          <select name="kind">
            <option value="ADD_OWNER">Add a co-owner</option>
            {primary && (
              <option value="TRANSFER">Transfer primary ownership</option>
            )}
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button className="button">Send ownership proposal</button>
        <span role="status">{message}</span>
      </div>
    </form>
  );
}
export function OwnershipDecision({
  projectId,
  transferId,
  recipient,
}: {
  projectId: string;
  transferId: string;
  recipient: boolean;
}) {
  const [error, setError] = useState("");
  const router = useRouter();
  async function action(action: string) {
    if (
      action === "ACCEPT" &&
      !confirm(
        "Accept this ownership responsibility? Your current verified Vine Iternational Christian Academy account will be recorded as a project owner.",
      )
    )
      return;
    try {
      await api(`/api/projects/${projectId}/ownership`, "PATCH", {
        transferId,
        action,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="form-actions">
      {recipient ? (
        <>
          <button className="button small" onClick={() => action("ACCEPT")}>
            Accept ownership
          </button>
          <button className="text-button" onClick={() => action("REJECT")}>
            Decline
          </button>
        </>
      ) : (
        <button className="text-button" onClick={() => action("CANCEL")}>
          Cancel proposal
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
