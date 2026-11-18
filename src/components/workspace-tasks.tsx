"use client";
import { useEffect, useState } from "react";
import { api } from "./actions";
type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string | null;
  dueAt: string | null;
  milestone: boolean;
  assignee: { id: string; name: string | null } | null;
};
export function WorkspaceTasks({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const result = await api(`/api/projects/${projectId}/tasks`, "GET");
      setTasks(result.tasks);
      setEditable(result.canEdit);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [projectId]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    const due = String(f.get("dueAt") || "");
    try {
      await api(
        `/api/projects/${projectId}/tasks`,
        editing ? "PATCH" : "POST",
        {
          ...(editing ? { taskId: editing.id } : {}),
          title: f.get("title"),
          description: f.get("description"),
          status: f.get("status"),
          assigneeId: String(f.get("assigneeId") || "") || null,
          dueAt: due ? new Date(due).toISOString() : null,
          milestone: f.has("milestone"),
        },
      );
      setEditing(null);
      form.reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Tasks & milestones</h2>
      <p className="page-subtitle" style={{ fontSize: 12 }}>
        Visible only to approved, eligible Vic Academy collaborators.
        Contributors and project owners can make changes.
      </p>
      {loading && <p role="status">Loading workspace tasks…</p>}
      {tasks.map((task) => (
        <article className="request-card" key={task.id}>
          <span className="status">
            {task.milestone ? "MILESTONE · " : ""}
            {task.status.replaceAll("_", " ")}
          </span>
          <h3 style={{ marginTop: 12 }}>{task.title}</h3>
          <p>{task.description}</p>
          <small>
            {task.assignee?.name || "Unassigned"}
            {task.dueAt
              ? ` · Due ${new Date(task.dueAt).toLocaleString()}`
              : ""}
          </small>
          {editable && (
            <div className="form-actions">
              <button className="text-button" onClick={() => setEditing(task)}>
                Edit task
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  if (
                    !confirm(
                      "Delete this task? This action is recorded in the activity log.",
                    )
                  )
                    return;
                  try {
                    await api(`/api/projects/${projectId}/tasks`, "DELETE", {
                      taskId: task.id,
                    });
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Delete
              </button>
            </div>
          )}
        </article>
      ))}
      {!loading && !tasks.length && (
        <p className="prose">No tasks yet. Start with a small next step.</p>
      )}
      {editable && (
        <form onSubmit={submit} key={editing?.id || "new"}>
          <h3
            style={{
              fontFamily: "Georgia,serif",
              fontWeight: 400,
              fontSize: 23,
              margin: "25px 0 18px",
            }}
          >
            {editing ? "Update a task" : "Create a task or milestone"}
          </h3>
          <div className="form-grid">
            <label className="field span-2">
              Title
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                defaultValue={editing?.title}
              />
            </label>
            <label className="field span-2">
              Description
              <textarea
                name="description"
                maxLength={10000}
                defaultValue={editing?.description}
              />
            </label>
            <label className="field">
              Status
              <select name="status" defaultValue={editing?.status || "TODO"}>
                <option value="TODO">To do</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </label>
            <label className="field">
              Due date & time
              <input
                name="dueAt"
                type="datetime-local"
                defaultValue={
                  editing?.dueAt
                    ? new Date(
                        new Date(editing.dueAt).getTime() -
                          new Date(editing.dueAt).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>
            <label className="field">
              Assignee user ID
              <input
                name="assigneeId"
                defaultValue={editing?.assigneeId || ""}
              />
              <small>
                Optional. The server checks current membership and eligibility.
              </small>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                name="milestone"
                defaultChecked={editing?.milestone}
              />
              This is a milestone
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create task"}
            </button>
            {editing && (
              <button
                className="text-button"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
