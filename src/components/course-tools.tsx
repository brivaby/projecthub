"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./actions";
export function CreateCourse() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const result = await api(
            "/api/courses",
            "POST",
            Object.fromEntries(f),
          );
          router.push(`/courses/${result.id}`);
          router.refresh();
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Create a course</h2>
      <div className="form-grid">
        <label className="field">
          Course name
          <input name="name" required minLength={3} maxLength={160} />
        </label>
        <label className="field">
          Institution
          <input
            name="institution"
            required
            defaultValue="Vic Academy"
            maxLength={160}
          />
        </label>
        <label className="field span-2">
          Description
          <textarea name="description" maxLength={5000} />
        </label>
      </div>
      <div className="form-actions">
        <button className="button" disabled={busy}>
          Create course
        </button>
      </div>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
export function JoinCourse() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await api(
            `/api/courses/${encodeURIComponent(String(f.get("courseId")))}/members`,
            "POST",
            { action: "REQUEST" },
          );
          setMessage("Membership requested. Your teacher will review it.");
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <h2>Join your class</h2>
      <p className="page-subtitle" style={{ fontSize: 12 }}>
        Enter the course ID provided by your teacher. Enrollment requires a
        verified Vic Academy email.
      </p>
      <label className="field">
        Course ID
        <input name="courseId" required />
      </label>
      <div className="form-actions">
        <button className="button secondary">Request membership</button>
        <span role="status">{message}</span>
      </div>
    </form>
  );
}
type Submission = {
  id: string;
  projectId: string;
  userId: string;
  status: string;
  grade: number | null;
  feedback: string | null;
};
type Assignment = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  maxScore: number;
  rubric: { criterion: string; points: number }[];
  requiresReview: boolean;
  submissions: Submission[];
};
type Membership = {
  userId: string;
  status: string;
  role: string;
  user: { name: string | null };
};
type Group = { id: string; name: string; members: { userId: string }[] };
type Collection = {
  id: string;
  title: string;
  public: boolean;
  projects: { project: { id: string; title: string; summary: string } }[];
};
type CourseData = {
  teacher: boolean;
  course: {
    id: string;
    name: string;
    description: string;
    teacherId: string | null;
  };
  assignments: Assignment[];
  memberships: Membership[];
  classes: Group[];
  collections: Collection[];
};
export function CourseWorkspace({ courseId }: { courseId: string }) {
  const [data, setData] = useState<CourseData | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await api(`/api/courses/${courseId}`, "GET"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [courseId]);
  async function action(path: string, method: string, value: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(
        `/api/courses/${courseId}/${path}`,
        method,
        value,
      );
      setMessage(result.message || "Changes saved.");
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function values(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form));
  }
  if (!data)
    return (
      <div className="panel">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : (
          <p role="status">Loading your course…</p>
        )}
      </div>
    );
  const teacher = data.teacher;
  return (
    <>
      <div className="workspace-nav">
        <Link href="#assignments">Assignments & feedback</Link>
        <Link href="#classes">Classes</Link>
        <Link href="#showcases">Project collections</Link>
        {teacher && (
          <a href={`/api/courses/${courseId}/export`}>Export private grades</a>
        )}
      </div>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {teacher && (
        <section className="panel">
          <h2>Course members</h2>
          <p className="page-subtitle" style={{ fontSize: 12 }}>
            Course ID: <code>{courseId}</code>. Share it with your students so
            they can request membership.
          </p>
          {data.memberships.map((m) => (
            <div className="file-row" key={m.userId}>
              <div>
                {m.user.name || "Student"}
                <small>
                  {m.role} · {m.status} · {m.userId}
                </small>
              </div>
              {m.userId !== data.course.teacherId && (
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {m.status !== "APPROVED" && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        action("members", "POST", {
                          action: "APPROVE",
                          userId: m.userId,
                        })
                      }
                    >
                      Approve
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      action("members", "POST", {
                        action: "REJECT",
                        userId: m.userId,
                      })
                    }
                  >
                    Reject
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Remove this member from the course and its classes?",
                        )
                      )
                        void action("members", "POST", {
                          action: "REMOVE",
                          userId: m.userId,
                        });
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              if (
                await action("members", "POST", {
                  action: "INVITE",
                  ...values(form),
                })
              )
                form.reset();
            }}
          >
            <div className="form-grid">
              <label className="field">
                Invite verified Vic Academy email
                <input name="email" type="email" required />
              </label>
              <label className="field">
                Course role
                <select name="role">
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">
                    Teacher (existing teacher accounts only)
                  </option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button className="button secondary" disabled={busy}>
                Invite to course
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel" id="assignments">
        <h2>Assignments & private feedback</h2>
        <p className="page-subtitle" style={{ fontSize: 12 }}>
          Grades and feedback are visible only to the submitting student and
          authorized teachers.
        </p>
        {data.assignments.map((assignment) => (
          <article className="request-card" key={assignment.id}>
            <h3>{assignment.title}</h3>
            <p>{assignment.description}</p>
            <small>
              {assignment.deadline
                ? `Due ${new Date(assignment.deadline).toLocaleString()}`
                : "No deadline"}{" "}
              · {assignment.maxScore} points ·{" "}
              {assignment.requiresReview
                ? "Teacher approval required before publication"
                : "Publication review optional"}
            </small>
            <details style={{ marginTop: 15 }}>
              <summary>Assessment rubric</summary>
              <ul>
                {assignment.rubric.map((r, i) => (
                  <li key={i} style={{ marginTop: 8, fontSize: 12 }}>
                    {r.criterion} — {r.points} points
                  </li>
                ))}
              </ul>
            </details>
            {teacher && (
              <details style={{ margin: "20px 0" }}>
                <summary>Edit assignment & deadline</summary>
                <form
                  style={{ marginTop: 18 }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const deadline = String(f.get("deadline") || "");
                    const rubric = String(f.get("rubric") || "")
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => {
                        const split = line.lastIndexOf("|");
                        return {
                          criterion: line.slice(0, split).trim(),
                          points: Number(line.slice(split + 1).trim()),
                        };
                      });
                    await action("assignments", "PATCH", {
                      assignmentId: assignment.id,
                      title: f.get("title"),
                      description: f.get("description"),
                      maxScore: Number(f.get("maxScore")),
                      deadline: deadline
                        ? new Date(deadline).toISOString()
                        : null,
                      rubric,
                      requiresReview: f.has("requiresReview"),
                    });
                  }}
                >
                  <div className="form-grid">
                    <label className="field span-2">
                      Title
                      <input
                        name="title"
                        required
                        minLength={3}
                        defaultValue={assignment.title}
                      />
                    </label>
                    <label className="field span-2">
                      Instructions
                      <textarea
                        name="description"
                        required
                        minLength={10}
                        defaultValue={assignment.description}
                      />
                    </label>
                    <label className="field">
                      Deadline
                      <input
                        name="deadline"
                        type="datetime-local"
                        defaultValue={
                          assignment.deadline
                            ? new Date(
                                new Date(assignment.deadline).getTime() -
                                  new Date(
                                    assignment.deadline,
                                  ).getTimezoneOffset() *
                                    60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                      />
                    </label>
                    <label className="field">
                      Maximum score
                      <input
                        name="maxScore"
                        type="number"
                        required
                        min={1}
                        max={10000}
                        defaultValue={assignment.maxScore}
                      />
                    </label>
                    <label className="field span-2">
                      Rubric: criterion | points
                      <textarea
                        name="rubric"
                        required
                        defaultValue={assignment.rubric
                          .map((r) => `${r.criterion} | ${r.points}`)
                          .join("\n")}
                      />
                    </label>
                    <label className="check-field span-2">
                      <input
                        type="checkbox"
                        name="requiresReview"
                        defaultChecked={assignment.requiresReview}
                      />
                      Require publication review
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="button small" disabled={busy}>
                      Save assignment
                    </button>
                  </div>
                </form>
              </details>
            )}
            {assignment.submissions.map((submission) => (
              <div
                className="panel"
                style={{ marginTop: 20 }}
                key={submission.id}
              >
                <span className="status">{submission.status}</span>
                <p>
                  <Link
                    href={`/projects/${submission.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View submitted project ↗
                  </Link>
                </p>
                {submission.grade !== null && (
                  <p>
                    Grade: {submission.grade} / {assignment.maxScore}
                  </p>
                )}
                {submission.feedback && (
                  <p className="prose">
                    Private feedback: {submission.feedback}
                  </p>
                )}
                {teacher && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const grade = String(f.get("grade") || "");
                      await action("submissions", "PATCH", {
                        submissionId: submission.id,
                        status: f.get("status"),
                        feedback: f.get("feedback"),
                        ...(grade ? { grade: Number(grade) } : {}),
                        publish: f.has("publish"),
                      });
                    }}
                  >
                    <div className="form-grid">
                      <label className="field">
                        Review decision
                        <select
                          name="status"
                          defaultValue={
                            submission.status === "REJECTED"
                              ? "REJECTED"
                              : "APPROVED"
                          }
                        >
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">
                            Needs revision / rejected
                          </option>
                        </select>
                      </label>
                      <label className="field">
                        Grade
                        <input
                          name="grade"
                          type="number"
                          min={0}
                          max={assignment.maxScore}
                          step="any"
                          defaultValue={submission.grade ?? ""}
                        />
                      </label>
                      <label className="field span-2">
                        Private feedback
                        <textarea
                          name="feedback"
                          defaultValue={submission.feedback || ""}
                          maxLength={20000}
                        />
                      </label>
                      <label className="check-field span-2">
                        <input type="checkbox" name="publish" />
                        Publish approved project publicly (creator’s rights
                        confirmation required)
                      </label>
                    </div>
                    <button className="button small" disabled={busy}>
                      Save private review
                    </button>
                  </form>
                )}
              </div>
            ))}
            {!teacher && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await action("submissions", "POST", {
                      assignmentId: assignment.id,
                      projectId: values(form).projectId,
                    })
                  )
                    form.reset();
                }}
              >
                <label className="field" style={{ marginTop: 20 }}>
                  Submit your project ID
                  <input name="projectId" required />
                </label>
                <small style={{ display: "block", marginTop: 8 }}>
                  Submit only a project you own. Reviewed assignments stay
                  private until approved.
                </small>
                <div className="form-actions">
                  <button className="button secondary" disabled={busy}>
                    Submit project
                  </button>
                </div>
              </form>
            )}
          </article>
        ))}
        {!data.assignments.length && (
          <p className="prose">Your teacher has not added an assignment yet.</p>
        )}
        {teacher && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const criteria = String(f.get("rubric") || "")
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const i = line.lastIndexOf("|");
                  return {
                    criterion: line.slice(0, i).trim(),
                    points: Number(line.slice(i + 1).trim()),
                  };
                });
              const deadline = String(f.get("deadline") || "");
              if (
                await action("assignments", "POST", {
                  title: f.get("title"),
                  description: f.get("description"),
                  deadline: deadline ? new Date(deadline).toISOString() : null,
                  maxScore: Number(f.get("maxScore")),
                  rubric: criteria,
                  requiresReview: f.has("requiresReview"),
                })
              )
                form.reset();
            }}
          >
            <h3 className="page-title" style={{ fontSize: 25, marginTop: 30 }}>
              Create an assignment
            </h3>
            <div className="form-grid">
              <label className="field span-2">
                Assignment title
                <input name="title" required minLength={3} maxLength={180} />
              </label>
              <label className="field span-2">
                Instructions
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={20000}
                />
              </label>
              <label className="field">
                Deadline
                <input name="deadline" type="datetime-local" />
              </label>
              <label className="field">
                Maximum score
                <input
                  name="maxScore"
                  type="number"
                  min={1}
                  max={10000}
                  defaultValue={100}
                />
              </label>
              <label className="field span-2">
                Rubric: one criterion | points per line
                <textarea
                  name="rubric"
                  required
                  defaultValue={
                    "Research & evidence | 30\nTechnical execution | 40\nDocumentation & reflection | 30"
                  }
                />
                <small>Points must add up to the maximum score.</small>
              </label>
              <label className="check-field span-2">
                <input type="checkbox" name="requiresReview" defaultChecked />
                Require teacher review before public publication
              </label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={busy}>
                Create assignment
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="panel" id="classes">
        <h2>Class groups</h2>
        {data.classes.map((group) => (
          <div className="file-row" key={group.id}>
            <div>
              {group.name}
              <small>
                {group.members.length} visible member
                {group.members.length === 1 ? "" : "s"} · {group.id}
              </small>
            </div>
          </div>
        ))}
        {teacher && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (
                  await action("classes", "POST", {
                    action: "CREATE",
                    ...values(form),
                  })
                )
                  form.reset();
              }}
            >
              <label className="field">
                New class name
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <div className="form-actions">
                <button className="button secondary" disabled={busy}>
                  Create class
                </button>
              </div>
            </form>
            {!!data.classes.length && (
              <form
                style={{ marginTop: 25 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  await action("classes", "POST", values(e.currentTarget));
                }}
              >
                <div className="form-grid">
                  <label className="field">
                    Class
                    <select name="classId">
                      {data.classes.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Approved member
                    <select name="userId">
                      {data.memberships
                        .filter((m) => m.status === "APPROVED")
                        .map((m) => (
                          <option value={m.userId} key={m.userId}>
                            {m.user.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Action
                    <select name="action">
                      <option value="ADD">Add to class</option>
                      <option value="REMOVE">Remove from class</option>
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button className="button secondary" disabled={busy}>
                    Update class
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
      <section className="panel" id="showcases">
        <h2>Project collections & showcases</h2>
        {data.collections.map((collection) => (
          <article className="request-card" key={collection.id}>
            <h3>{collection.title}</h3>
            <span className="status">
              {collection.public ? "PUBLIC SHOWCASE" : "CLASS COLLECTION"}
            </span>
            {collection.public && (
              <p>
                <Link
                  href={`/courses/showcases/${collection.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open public showcase ↗
                </Link>
              </p>
            )}
            {collection.projects.map(({ project }) => (
              <p key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {project.title} ↗
                </Link>
              </p>
            ))}
          </article>
        ))}
        {teacher && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (
                  await action("collections", "POST", {
                    action: "CREATE",
                    title: f.get("title"),
                    public: f.has("public"),
                  })
                )
                  form.reset();
              }}
            >
              <label className="field">
                Collection title
                <input name="title" required minLength={3} maxLength={180} />
              </label>
              <label className="check-field" style={{ marginTop: 15 }}>
                <input name="public" type="checkbox" />
                Make the showcase public (only public projects are displayed)
              </label>
              <div className="form-actions">
                <button className="button secondary" disabled={busy}>
                  Create collection
                </button>
              </div>
            </form>
            {!!data.collections.length && (
              <form
                style={{ marginTop: 25 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  await action("collections", "POST", values(e.currentTarget));
                }}
              >
                <div className="form-grid">
                  <label className="field">
                    Collection
                    <select name="collectionId">
                      {data.collections.map((collection) => (
                        <option value={collection.id} key={collection.id}>
                          {collection.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Project ID
                    <input name="projectId" required />
                  </label>
                  <label className="field">
                    Action
                    <select name="action">
                      <option value="ADD">Add project</option>
                      <option value="REMOVE">Remove project</option>
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <button className="button secondary" disabled={busy}>
                    Update collection
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
      {teacher && (
        <section className="panel">
          <h2>Course settings</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                f.has("archived") &&
                !confirm(
                  "Archive this course? It will no longer be accessible to members.",
                )
              )
                return;
              setBusy(true);
              try {
                await api(`/api/courses/${courseId}`, "PATCH", {
                  name: f.get("name"),
                  description: f.get("description"),
                  archived: f.has("archived"),
                });
                window.location.href = "/courses";
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label className="field">
                Course name
                <input
                  name="name"
                  required
                  minLength={3}
                  defaultValue={data.course.name}
                />
              </label>
              <label className="field span-2">
                Description
                <textarea
                  name="description"
                  defaultValue={data.course.description}
                />
              </label>
              <label className="check-field">
                <input type="checkbox" name="archived" />
                Archive this course
              </label>
            </div>
            <div className="form-actions">
              <button className="button secondary" disabled={busy}>
                Save course settings
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
