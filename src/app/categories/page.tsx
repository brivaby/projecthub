import Link from "next/link";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
export default async function Categories() {
  const categories = await db.category.findMany({
    include: {
      _count: {
        select: {
          projects: {
            where: { visibility: "PUBLIC", status:"PUBLISHED", deletedAt: null, archived: false },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return (
    <div className="container page">
      <span className="eyebrow">MANY DISCIPLINES. ENDLESS POSSIBILITIES.</span>
      <h1 className="page-title">Follow your curiosity.</h1>
      <p className="page-subtitle">
        The next idea that inspires you might come from somewhere unexpected.
      </p>
      <div className="subject-grid">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/trending?category=${encodeURIComponent(c.name)}`}
          >
            <BookOpen />
            <h3>{c.name}</h3>
            <span>
              {c._count.projects} projects <ArrowUpRight size={15} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
