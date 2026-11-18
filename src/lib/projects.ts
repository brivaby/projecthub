import { db } from "./db";
import { Prisma } from "@prisma/client";
import { verifiedVic } from "./eligibility";
import { affinity, diversify } from "./ranking";
import { rankingWeightsSchema,defaultRankingWeights } from "./platform-settings";
export const cardInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      image: true,
      profile: { select: { showInstitution: true, showInRankings: true } },
    },
  },
  files: {
    where: { isCover: true, scanStatus: "CLEAN",OR:[{versionId:null},{version:{status:"PUBLISHED"}}] },
    select: { id: true },
    take: 1,
  },
  category: true,
  institution: true,
  course: true,
  tags: { include: { tag: true } },
  _count: {
    select: {
      views: true,
      comments: { where: { status: "PUBLIC" } },
      engagements: true,
      requests: { where: { status: { in: ["ACCEPTED", "COMPLETED"] } } },
    },
  },
  engagements: { select: { kind: true } },
  requests: {
    where: { status: { in: ["ACCEPTED", "COMPLETED"] } },
    select: { type: true },
  },
  ratings: { select: { score: true } },
} satisfies Prisma.ProjectInclude;
export type ProjectCardData = Prisma.ProjectGetPayload<{
  include: typeof cardInclude;
}>;
export function metrics(p: ProjectCardData) {
  return {
    views: p._count.views,
    likes: p.engagements.filter((e) => e.kind === "LIKE").length,
    bookmarks: p.engagements.filter((e) => e.kind === "BOOKMARK").length,
    comments: p._count.comments,
    clones: p.requests.filter((r) => r.type === "CLONE").length,
    collaborations: p.requests.filter((r) => r.type === "COLLABORATION").length,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  };
}
// Ranking aggregates and pagination execute in PostgreSQL across the complete authorized catalog.
export async function discover(
  params: Record<string, string | undefined> = {},
  interests: string[] = [],
  userId?: string,
) {
  const rankingSetting=await db.platformSetting.findUnique({where:{key:'rankingWeights'}});const parsedWeights=rankingWeightsSchema.safeParse(rankingSetting?.value);const weights=parsedWeights.success?parsedWeights.data:defaultRankingWeights;
  const user = userId
    ? await db.user.findUnique({ where: { id: userId } })
    : null;
  const visible = [
    Prisma.sql`p.visibility='PUBLIC'`,
    Prisma.sql`(p.visibility='SCHEDULED' AND p."scheduledAt"<=NOW())`,
  ];
  if (verifiedVic(user)) visible.push(Prisma.sql`p.visibility='INSTITUTION'`);
  if (user && !user.suspended && !user.deletedAt&&(verifiedVic(user)||user.role==='TEACHER'||user.role==='ADMIN'))
    visible.push(
      Prisma.sql`(p.visibility='COURSE' AND EXISTS(SELECT 1 FROM "Course" ec LEFT JOIN "CourseMembership" cm ON cm."courseId"=ec.id AND cm."userId"=${user.id} AND cm.status='APPROVED' WHERE ec.id=p."courseId" AND (ec."teacherId"=${user.id} OR (cm."userId" IS NOT NULL AND ${verifiedVic(user)}))))`,
    );
  const predicates = [
    Prisma.sql`(${Prisma.join(visible, " OR ")})`,
    Prisma.sql`p.status='PUBLISHED'`,
    Prisma.sql`p."deletedAt" IS NULL AND p.archived=false AND u.suspended=false AND u."deletedAt" IS NULL`,
  ];
  if (params.visibility === "INSTITUTION") {
    if (!verifiedVic(user)) return { projects: [], total: 0, page: 1 };
    predicates.push(Prisma.sql`p.visibility='INSTITUTION'`);
  }
  if (params.visibility === "COURSE")
    predicates.push(Prisma.sql`p.visibility='COURSE'`);
  if (params.q) {
    const q = params.q.trim().slice(0, 200);
    predicates.push(
      Prisma.sql`(to_tsvector('english',p.title||' '||p.summary||' '||p.description) @@ websearch_to_tsquery('english',${q}) OR to_tsvector('english',COALESCE(u.name,'')||' '||i.name||' '||COALESCE(c.name,'')||' '||array_to_string(p.technologies,' ')||' '||array_to_string(p.languages,' ')) @@ websearch_to_tsquery('english',${q}) OR EXISTS(SELECT 1 FROM "ProjectTag" pt JOIN "Tag" t ON t.id=pt."tagId" WHERE pt."projectId"=p.id AND t.name ILIKE ${"%" + q + "%"}) OR EXISTS(SELECT 1 FROM "Contributor" ct WHERE ct."projectId"=p.id AND ct.name ILIKE ${"%" + q + "%"}))`,
    );
  }
  const fields: Record<string, Prisma.Sql> = {
    category: Prisma.sql`cat.name`,
    level: Prisma.sql`p."academicLevel"`,
    type: Prisma.sql`p."projectType"`,
    license: Prisma.sql`p.license`,
  };
  for (const [key, field] of Object.entries(fields))
    if (params[key]) predicates.push(Prisma.sql`${field}=${params[key]}`);
  if (params.institution)
    predicates.push(
      Prisma.sql`i.name ILIKE ${"%" + params.institution.slice(0, 160) + "%"}`,
    );
  if (params.course)
    predicates.push(
      Prisma.sql`c.name ILIKE ${"%" + params.course.slice(0, 160) + "%"}`,
    );
  if (params.technology)
    predicates.push(Prisma.sql`${params.technology}=ANY(p.technologies)`);
  if (params.language)
    predicates.push(Prisma.sql`${params.language}=ANY(p.languages)`);
  if (params.open === "true")
    predicates.push(Prisma.sql`p.collaboration IN ('OPEN','LIMITED')`);
  if (params.clone === "true")
    predicates.push(
      Prisma.sql`p."cloningAllowed"=true AND p."clonePolicy"<>'DISABLED'`,
    );
  if (params.since && !isNaN(Date.parse(params.since)))
    predicates.push(Prisma.sql`p."publishedAt">=${new Date(params.since)}`);
  if (params.sort === "recommended")
    predicates.push(Prisma.sql`p.recommendable=true`);
  const where = Prisma.join(predicates, " AND ");
  const joins = Prisma.sql`FROM "Project" p JOIN "User" u ON u.id=p."ownerId" JOIN "Institution" i ON i.id=p."institutionId" JOIN "Category" cat ON cat.id=p."categoryId" LEFT JOIN "Course" c ON c.id=p."courseId"`;
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  const [{ total }] = await db.$queryRaw<
    { total: bigint }[]
  >`SELECT COUNT(*) total ${joins} WHERE ${where}`;
  const sort: Record<string, string> = {
    views: "views DESC",
    clones: "clones DESC",
    collaborations: "collaborations DESC",
    bookmarks: "bookmarks DESC",
    rated: "rating DESC, likes DESC",
    endorsed: "likes DESC",
    newest: 'p."publishedAt" DESC',
    updated: 'p."updatedAt" DESC',
    relevance: "score DESC",
    recommended: "score DESC",
  };
  const ids = await db.$queryRaw<{ id: string }[]>`SELECT p.id,
 (SELECT COUNT(*) FROM "ProjectView" v WHERE v."projectId"=p.id) views,
 (SELECT COUNT(*) FROM "Engagement" e WHERE e."projectId"=p.id AND e.kind='LIKE') likes,
 (SELECT COUNT(*) FROM "Engagement" e WHERE e."projectId"=p.id AND e.kind='BOOKMARK') bookmarks,
 (SELECT COUNT(*) FROM "Request" r WHERE r."projectId"=p.id AND r.type='CLONE' AND r.status IN ('ACCEPTED','COMPLETED')) clones,
 (SELECT COUNT(*) FROM "Request" r WHERE r."projectId"=p.id AND r.type='COLLABORATION' AND r.status IN ('ACCEPTED','COMPLETED')) collaborations,
 COALESCE((SELECT AVG(rt.score) FROM "Rating" rt WHERE rt."projectId"=p.id),0) rating,
 (${weights.views}*LN(1+(SELECT COUNT(*) FROM "ProjectView" v WHERE v."projectId"=p.id))+${weights.likes}*(SELECT COUNT(*) FROM "Engagement" e WHERE e."projectId"=p.id AND e.kind='LIKE')+${weights.bookmarks}*(SELECT COUNT(*) FROM "Engagement" e WHERE e."projectId"=p.id AND e.kind='BOOKMARK')+${weights.comments}*(SELECT COUNT(*) FROM "Comment" cm WHERE cm."projectId"=p.id AND cm.status='PUBLIC')+${weights.clones}*(SELECT COUNT(*) FROM "Request" r WHERE r."projectId"=p.id AND r.type='CLONE' AND r.status IN ('ACCEPTED','COMPLETED'))+${weights.collaborations}*(SELECT COUNT(*) FROM "Request" r WHERE r."projectId"=p.id AND r.type='COLLABORATION' AND r.status IN ('ACCEPTED','COMPLETED')))/POWER(1+GREATEST(0,EXTRACT(EPOCH FROM (NOW()-p."publishedAt"))/86400)/${weights.decayDays},${weights.decayPower}) score
 ${joins} WHERE ${where} ORDER BY ${Prisma.raw(sort[params.sort || "relevance"] || sort.relevance)},p.id LIMIT 12 OFFSET ${(page - 1) * 12}`;
  const rows = await db.project.findMany({
    where: { id: { in: ids.map((x) => x.id) } },
    include: cardInclude,
  });
  const order = new Map(ids.map((x, i) => [x.id, i]));
  rows.sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
  if (params.sort === "recommended") {
    rows.sort(
      (a, b) =>
        affinity(
          [...b.tags.map((t) => t.tag.name), b.category.name],
          b.technologies,
          interests,
        ) -
        affinity(
          [...a.tags.map((t) => t.tag.name), a.category.name],
          a.technologies,
          interests,
        ),
    );
    return { projects: diversify(rows), total: Number(total), page };
  }
  return { projects: rows, total: Number(total), page };
}
