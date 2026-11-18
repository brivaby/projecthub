import Link from "next/link";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui";
export default async function Community() {
  const users = await db.user.findMany({
    where: { deletedAt: null, suspended: false, profile: { public: true } },
    select: {
      id: true,
      name: true,
      profile: { select: { institution: true } },
      _count: {
        select: {
          projects: {
            where: { visibility: "PUBLIC", status:"PUBLISHED", deletedAt: null, archived: false },
          },
        },
      },
    },
    take: 100,
  });
  return (
    <div className="container page">
      <span className="eyebrow">CURIOUS MINDS. SHARED POSSIBILITIES.</span>
      <h1 className="page-title">Meet your kind of people.</h1>
      <p className="page-subtitle">
        Students, makers, and researchers taking ideas a little further.
      </p>
      <div className="creator-grid">
        {users.map((u, i) => (
          <Link href={`/people/${u.id}`} key={u.id}>
            <span className={`creator-avatar color-${i % 4}`}>
              <Avatar name={u.name || "Student"} />
            </span>
            <h3>{u.name}</h3>
            <p>{u.profile?.institution}</p>
            <span>{u._count.projects} published projects ↗</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
