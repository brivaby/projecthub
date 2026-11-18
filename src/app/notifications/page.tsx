import Link from "next/link";
import { redirect } from "next/navigation";
import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { MarkRead } from "@/components/actions";
import { Empty } from "@/components/ui";
export default async function Notifications() {
  let u;
  try {
    u = await actor();
  } catch {
    redirect("/login");
  }
  const list = await db.notification.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="container page">
      <h1 className="page-title">You’re in the loop.</h1>
      <p className="page-subtitle">
        Requests, conversations, and the latest from your projects.
      </p>
      <MarkRead />
      <div style={{ marginTop: 25 }}>
        {list.map((n) => (
          <Link
            className={`notification ${n.readAt ? "" : "unread"}`}
            key={n.id}
            href={n.href}
          >
            {!n.readAt && <span className="green-dot" />}
            <span>{n.title}</span>
            <small>{n.createdAt.toLocaleDateString("en")}</small>
          </Link>
        ))}
      </div>
      {!list.length && (
        <Empty
          title="All quiet for now"
          text="We’ll let you know when something new happens."
        />
      )}
    </div>
  );
}
