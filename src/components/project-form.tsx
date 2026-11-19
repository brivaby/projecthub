"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "./actions";
import { licenses } from "@/lib/validation";
export type InitialProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  academicLevel: string;
  projectType: string;
  technologies: string[];
  languages: string[];
  status: string;
  scheduledAt: Date | string | null;
  commentPolicy: string;
  clonePolicy: string;
  recommendable: boolean;
  customLicense: string;
  integrityStatement: string;
  courseId: string | null;
  tags: { tag: { name: string } }[];
  institution: { name: string };
  category: { name: string };
  course: { name: string } | null;
  license: string;
  visibility: string;
  collaboration: string;
  cloningAllowed: boolean;
  commentsApproval: boolean;
  cover: string;
  links: { kind: string; url: string }[];
  contributors: { name: string; contribution: string }[];
  originalId: string | null;
};
type Upload = { id: string; file: File; cover: boolean; state: string; complete?: boolean };

export function ProjectForm({
  categories,
  initial,
  courses = [],
}: {
  categories: string[];
  courses?: { id: string; name: string; requiresReview: boolean }[];
  initial?: InitialProject;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const router = useRouter();
  const p = initial;
  const [savedId, setSavedId] = useState<string>();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [status, setStatus] = useState(
    p?.status === "PUBLISHED" || p?.status === "PENDING_REVIEW" ? p.status : "DRAFT",
  );
  const [visibility, setVisibility] = useState(p?.visibility || "PRIVATE");
  const [license, setLicense] = useState(p?.license || "All rights reserved");
  const [course, setCourse] = useState(p?.courseId || "");
  const [scheduledAt, setScheduledAt] = useState("");
  const requiresReview = courses.some((option) => option.id === course && option.requiresReview);
  const reviewRequested = status !== "DRAFT" && (status === "PENDING_REVIEW" || requiresReview);
  const action = status === "DRAFT" ? "Save draft" : reviewRequested
    ? "Submit for review" : visibility === "SCHEDULED" ? "Schedule publication" : "Publish";
  const initialSchedule = p?.scheduledAt;

  useEffect(() => {
    if (!initialSchedule) return;
    const date = new Date(initialSchedule);
    const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
    setScheduledAt(local.toISOString().slice(0, 16));
  }, [initialSchedule]);

  async function uploadFiles(id: string, queue: Upload[]) {
    const next = queue.map((upload) => ({ ...upload }));
    const publishState = () => setUploads(next.map((upload) => ({ ...upload })));
    publishState();
    for (const upload of next) {
      if (upload.complete) continue;
      upload.state = "Uploading";
      publishState();
      try {
        const scanStatus = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/projects/${id}/files`);
          xhr.responseType = "json";
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              upload.state = `Uploading ${Math.round(event.loaded / event.total * 100)}%`;
              publishState();
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response?.scanStatus);
            else reject(new Error(xhr.response?.error?.message || "Upload failed"));
          };
          xhr.onerror = () => reject(new Error("Upload interrupted"));
          const data = new FormData();
          data.set("file", upload.file);
          data.set("uploadId", upload.id);
          if (upload.cover) data.set("isCover", "true");
          xhr.send(data);
        });
        upload.complete = true;
        upload.state = scanStatus === "CLEAN" ? "Scan complete" : "Uploaded, awaiting scan";
      } catch (error) {
        upload.state = (error as Error).message;
      }
      publishState();
    }
    if (next.some((upload) => !upload.complete)) {
      setError("Your project was saved. Some files could not be uploaded.");
    } else if (!next.length) {
      router.push(`/projects/${id}`);
      router.refresh();
    }
  }

  async function retryUploads() {
    if (!savedId || busy) return;
    setBusy(true);
    setError("");
    try {
      await uploadFiles(savedId, uploads);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || uploads.length > 0) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const split = (key: string) =>
      String(f.get(key) || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    const text = (key: string) => String(f.get(key) || "");
    if (visibility === "COURSE" && !course) {
      setError("Select a managed course for course-only visibility.");
      setBusy(false);
      return;
    }
    const links = ["Repository", "Demo", "Documentation", "Video", "External"]
      .filter((k) => text(k))
      .map((kind) => ({ kind, url: text(kind) }));
    const existingId = p?.id;
    try {
      setProgress("Saving project…");
      const result = await api(
        existingId ? `/api/projects/${existingId}` : "/api/projects",
        existingId ? "PATCH" : "POST",
        {
          title: text("title"),
          summary: text("summary"),
          description: text("description"),
          category: text("category"),
          institution: text("institution"),
          course: text("course"),
          courseId: text("courseId") || undefined,
          languages: split("languages"),
          status: text("status"),
          scheduledAt: text("scheduledAt")
            ? new Date(text("scheduledAt")).toISOString()
            : undefined,
          commentPolicy: text("commentPolicy"),
          clonePolicy: text("clonePolicy"),
          recommendable: f.has("recommendable"),
          customLicense: text("customLicense"),
          integrityStatement: text("integrityStatement"),
          attestations: {
            rights: f.has("rights"),
            contributors: f.has("contributorsConsent"),
            privacy: f.has("privacyConsent"),
            attribution: f.has("attribution"),
            integrity: f.has("integrity"),
          },
          academicLevel: text("academicLevel"),
          projectType: text("projectType"),
          technologies: split("technologies"),
          tags: split("tags"),
          cover: text("cover"),
          license: text("license"),
          visibility: text("visibility"),
          collaboration: text("collaboration"),
          cloningAllowed: f.has("cloningAllowed"),
          commentsApproval: f.has("commentsApproval"),
          links,
          contributors: text("contributors")
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const [name, ...rest] = line.split("—");
              return { name: name.trim(), contribution: rest.join("—").trim() };
            }),
          originalId: p?.originalId || text("originalId") || undefined,
        },
      );
      const id = existingId || result.id;
      const cover = f.get("coverImage");
      const files = [
        ...(cover instanceof File && cover.size ? [cover] : []),
        ...f.getAll("files"),
      ].filter((x) => x instanceof File && x.size > 0) as File[];
      if (!id) throw new Error("The server did not return a project ID.");
      setSavedId(id);
      setProgress("");
      await uploadFiles(id, files.map((file) => ({
        id: crypto.randomUUID(), file, cover: file === cover, state: "Waiting",
      })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <form className="form-card" onSubmit={submit}>
      <fieldset className="form-grid project-fields" disabled={busy || uploads.length > 0} aria-label="Project details">
        <h2
          className="form-section-title"
          style={{ border: 0, margin: 0, padding: 0 }}
        >
          The big idea
        </h2>
        <label className="field span-2">
          Project title
          <input
            name="title"
            required
            minLength={5}
            maxLength={140}
            defaultValue={p?.title}
            placeholder="Give your idea a name"
          />
        </label>
        <label className="field span-2">
          Short summary
          <textarea
            name="summary"
            required
            minLength={20}
            maxLength={240}
            defaultValue={p?.summary}
            style={{ minHeight: 80 }}
            placeholder="What did you build, and why does it matter?"
          />
        </label>
        <label className="field span-2">
          Full description
          <textarea
            name="description"
            required
            minLength={80}
            maxLength={40000}
            defaultValue={p?.description}
            style={{ minHeight: 220 }}
            placeholder="The problem, your approach, what you learned, and what comes next…"
          />
        </label>
        <label className="field">
          Subject
          <select name="category" defaultValue={p?.category.name}>
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Institution
          <input
            name="institution"
            required
            defaultValue={p?.institution.name}
          />
        </label>
        <label className="field">
          Course
          <input name="course" defaultValue={p?.course?.name} />
        </label>
        <label className="field">
          Academic level
          <select name="academicLevel" defaultValue={p?.academicLevel}>
            {[
              "Undergraduate",
              "Postgraduate",
              "Secondary",
              "Doctoral",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Project type
          <select name="projectType" defaultValue={p?.projectType}>
            {[
              "Software",
              "Research",
              "Design",
              "Hardware",
              "Case study",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Technologies / tools
          <input
            name="technologies"
            defaultValue={p?.technologies.join(", ")}
            placeholder="Python, Arduino, Figma"
          />
          <small>Separate with commas. Up to 15.</small>
        </label>
        <label className="field span-2">
          Tags
          <input
            name="tags"
            defaultValue={p?.tags.map((t) => t.tag.name).join(", ")}
            placeholder="sustainability, machine learning, education"
          />
          <small>Separate with commas. Up to 10.</small>
        </label>
        <h2 className="form-section-title">Make it yours</h2>
        <label className="field">
          Cover illustration
          <select name="cover" defaultValue={p?.cover || "forest"}>
            {["forest", "ocean", "clay", "violet", "gold", "slate"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <small>Choose an original ProjectHub illustration.</small>
        </label>
        <label className="field">
          License
          <select
            name="license"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
          >
            {licenses.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          Contributors
          <textarea
            name="contributors"
            defaultValue={p?.contributors
              .map((c) => `${c.name} — ${c.contribution}`)
              .join("\n")}
            placeholder="One per line: Name — Contribution"
          />
        </label>
        <label className="field span-2">
          Custom cover image
          <input type="file" name="coverImage" accept=".png,.jpg,.jpeg,.webp" />
          <small>
            Optional. Your cover becomes visible after a clean malware scan.
          </small>
        </label>
        <label className="field span-2">
          Project files
          <input
            type="file"
            name="files"
            multiple
            accept=".zip,.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.pptx,.xlsx,.docx"
          />
          <small>
            25 MB per file. ZIP, PDF, images, Office documents, text, Markdown
            and CSV. Files are quarantined until malware scanning completes.
          </small>
        </label>
        {["Repository", "Demo", "Documentation", "Video", "External"].map(
          (kind) => (
            <label className="field span-2" key={kind}>
              {kind} URL
              <input
                type="url"
                name={kind}
                placeholder="https://"
                defaultValue={p?.links.find((l) => l.kind === kind)?.url}
              />
            </label>
          ),
        )}
        {!p && (
          <label className="field span-2">
            Original project ID (approved derivatives only)
            <input name="originalId" />
            <small>Keep attribution when building on an approved clone.</small>
          </label>
        )}
        <h2 className="form-section-title">Sharing & permissions</h2>
        <p className="warning span-2">
          Collaboration is currently limited to verified Vic Academy email
          accounts.
        </p>
        <label className="field">
          Managed course
          <select name="courseId" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">No managed course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <small>
            Course membership and teacher review are enforced on the server.
          </small>
        </label>
        <label className="field">
          Publication status
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="DRAFT">Draft</option>
            <option value="PENDING_REVIEW">Submit for teacher review</option>
            <option value="PUBLISHED">
              Publish (subject to teacher review)
            </option>
          </select>
        </label>
        <label className="field" hidden={visibility !== "SCHEDULED"}>
          Publication time (scheduled visibility)
          <input
            name="scheduledAt"
            disabled={visibility !== "SCHEDULED"}
            required={visibility === "SCHEDULED"}
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>
        <label className="field">
          Programming languages
          <input
            name="languages"
            placeholder="Python, TypeScript"
            defaultValue={p?.languages.join(", ")}
          />
        </label>
        <label className="field span-2" hidden={license !== "Custom"}>
          Custom license terms
          <textarea
            name="customLicense"
            disabled={license !== "Custom"}
            minLength={20}
            required={license === "Custom"}
            defaultValue={p?.customLicense}
            maxLength={15000}
          />
        </label>
        <label className="field">
          Visibility
          <select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="PRIVATE">
              Private — approved collaborators only
            </option>
            <option value="UNLISTED">Unlisted — anyone with the link</option>
            <option value="PUBLIC">Public — discoverable by everyone</option>
            <option value="INSTITUTION">
              Vic Academy verified accounts only
            </option>
            <option value="COURSE">Approved course members only</option>
            <option value="SCHEDULED">
              Public after scheduled publication time
            </option>
          </select>
        </label>
        <label className="field">
          Collaboration
          <select
            name="collaboration"
            defaultValue={p?.collaboration || "OPEN"}
          >
            <option value="OPEN">Open to collaborators</option>
            <option value="LIMITED">Limited availability</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        <label className="field">
          Comment access
          <select
            name="commentPolicy"
            defaultValue={p?.commentPolicy || "MODERATED"}
          >
            <option value="MODERATED">Owner approval required</option>
            <option value="OPEN">All authenticated accounts</option>
            <option value="VIC_ONLY">Verified Vic Academy accounts</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
        <label className="field">
          Clone policy
          <select name="clonePolicy" defaultValue={p?.clonePolicy || "MANUAL"}>
            <option value="MANUAL">Owner approval required</option>
            <option value="AUTO">
              Automatically approve with license consent
            </option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
        <label className="check-field span-2">
          <input
            name="recommendable"
            type="checkbox"
            defaultChecked={p?.recommendable ?? true}
          />
          Include this project in personalized recommendations
        </label>
        <h2 className="form-section-title">Rights & academic integrity</h2>
        <label className="field span-2">
          Attribution and AI-material disclosure
          <textarea
            name="integrityStatement"
            defaultValue={p?.integrityStatement}
            minLength={10}
            maxLength={2000}
            required
            placeholder="Describe sources, third-party materials and any AI assistance. State none if not applicable."
          />
        </label>
        {[
          ["rights", "I have the right to publish this project."],
          [
            "contributorsConsent",
            "Other contributors have agreed to this publication.",
          ],
          [
            "privacyConsent",
            "This project contains no confidential information or unauthorized personal data.",
          ],
          [
            "attribution",
            "Third-party materials are attributed and copyright is respected.",
          ],
          [
            "integrity",
            "This work follows school rules, identifies AI material where required, and is not uploaded to facilitate plagiarism.",
          ],
        ].map(([name, label]) => (
          <label className="check-field span-2" key={name}>
            <input name={name} type="checkbox" required />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="prose">
        {status === "DRAFT" ? "This project will stay a draft." : "Audience after publication: " + ({
          PRIVATE: "approved collaborators",
          UNLISTED: "anyone with the link",
          PUBLIC: "everyone",
          INSTITUTION: "verified Vic Academy accounts",
          COURSE: "approved course members",
          SCHEDULED: "everyone after the selected time",
        }[visibility] || visibility) + "."}
        {reviewRequested && (requiresReview
          ? " Teacher approval is required." : " This project will be submitted for review.")}
      </p>
      {uploads.length > 0 && (
        <ul aria-label="File upload status" aria-live="polite">
          {uploads.map((upload) => (
            <li key={upload.id}>{upload.file.name} · {upload.state}</li>
          ))}
        </ul>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        {uploads.length === 0 ? (
          <button className="button" disabled={busy}>{busy ? "Saving…" : action}</button>
        ) : uploads.some((upload) => !upload.complete) && (
          <button type="button" className="button" disabled={busy} onClick={retryUploads}>Retry failed uploads</button>
        )}
        {savedId && uploads.length > 0 && !busy && (
          <Link className="button secondary" href={error ? `/projects/${savedId}/edit` : `/projects/${savedId}`}>
            {error ? "Open saved project editor" : "View saved project"}
          </Link>
        )}
        <span role="status">{progress}</span>
      </div>
    </form>
  );
}
