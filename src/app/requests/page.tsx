import Link from "next/link";
import { redirect } from "next/navigation";
import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { Decision } from "@/components/actions";
import { Empty } from "@/components/ui";
export default async function Requests() {
  let u;
  try {
    u = await actor();
  } catch {
    redirect("/login");
  }
  const requests = await db.request.findMany({
    where: { OR: [{ userId: u.id }, { project: { OR:[{ownerId:u.id},{owners:{some:{userId:u.id}}}] } }] },
    include: {
      project: { select: { title: true, ownerId: true,owners:{select:{userId:true}} } },
      user: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div className="container page">
      <span className="eyebrow">
        GOOD COLLABORATIONS START WITH A CONVERSATION
      </span>
      <h1 className="page-title">Your requests.</h1>
      <div className="workspace-nav">
        <Link href="/dashboard">My projects</Link>
        <Link href="/requests">Requests</Link>
        <Link href="/notifications">Notifications</Link>
        <Link href="/settings">Settings</Link>
      </div>
      {requests.map((r) => (
        <article className="request-card" key={r.id} id={r.id}>
          <span className="status">
            {r.type} · {r.status}
          </span>
          <h3 style={{ marginTop: 15 }}>
            <Link
              href={`/projects/${r.projectId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.project.title} ↗
            </Link>
          </h3>
          <small>
            {(r.project.ownerId===u.id||r.project.owners.some(o=>o.userId===u.id))
              ? `From ${r.user.name || "Student"}`
              : "Submitted by you"}{" "}
            · {r.createdAt.toLocaleDateString("en")}
          </small>
          <p>{r.message}</p>
          <dl>
            {Object.entries(r.details as Record<string, unknown>).map(
              ([k, v]) => (
                <div key={k}>
                  <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ),
            )}
          </dl>
          {(r.project.ownerId===u.id||r.project.owners.some(o=>o.userId===u.id))&&r.privateNote&&<p className="license">Private owner note: {r.privateNote}</p>}
          {r.response && (
            <p>
              <strong>Owner response:</strong> {r.response}
            </p>
          )}
          {(["PENDING", "NEEDS_INFO"].includes(r.status) ||
            (r.status === "ACCEPTED" && (r.project.ownerId===u.id||r.project.owners.some(o=>o.userId===u.id)))) && (
            <Decision
              id={r.id}
              status={r.status}
              owner={(r.project.ownerId===u.id||r.project.owners.some(o=>o.userId===u.id))}
            />
          )}
        </article>
      ))}
      {!requests.length && (
        <Empty
          title="Your next collaboration starts here"
          text="Requests you send and receive will appear here."
        />
      )}
    </div>
  );
}
