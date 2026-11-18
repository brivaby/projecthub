import { db } from "./db";
import { discover } from "./projects";
export async function recommendations(userId?: string) {
  const configuration=await db.platformSetting.findUnique({where:{key:"recommendations"}});const settings=configuration?.value as {enabled?:boolean;personalization?:boolean;diversity?:boolean}|null;if(settings?.enabled===false)return {projects:[],total:0,page:1,reasons:{}};
  const profile = userId
    ? await db.profile.findUnique({ where: { userId } })
    : null;
  if (!userId || settings?.personalization===false || profile?.personalizedRecommendations === false) {
    const data = await discover({ sort: "recommended" });
    return {
      ...data,
      reasons: Object.fromEntries(
        data.projects.map((p) => [
          p.id,
          "Recent student work from different academic disciplines.",
        ]),
      ),
    };
  }
  const [saves, follows, viewed] = await Promise.all([
    db.engagement.findMany({
      where: {
        userId,
        kind: "BOOKMARK",
        project: {
          visibility: "PUBLIC",
          status: "PUBLISHED",
          deletedAt: null,
          archived: false,
        },
      },
      include: {
        project: {
          select: {
            technologies: true,
            tags: { include: { tag: true } },
            category: { select: { name: true } },
          },
        },
      },
      take: 50,
    }),
    db.followedCategory.findMany({
      where: { userId },
      include: { category: true },
    }),
    db.viewHistory.findMany({
      where: {
        userId,
        project: {
          visibility: "PUBLIC",
          status: "PUBLISHED",
          deletedAt: null,
          archived: false,
        },
      },
      include: {
        project: {
          select: { technologies: true, category: { select: { name: true } } },
        },
      },
      orderBy: { viewedAt: "desc" },
      take: 30,
    }),
  ]);
  const interests = [
    ...(profile?.interests || []),
    ...(profile?.technologies || []),
    ...saves.flatMap((s) => [
      ...s.project.technologies,
      ...s.project.tags.map((t) => t.tag.name),
      s.project.category.name,
    ]),
    ...follows.map((f) => f.category.name),
    ...viewed.flatMap((v) => [
      ...v.project.technologies,
      v.project.category.name,
    ]),
  ];
  const data = await discover({ sort: "recommended" }, interests, userId);
  const savedTools = new Set(saves.flatMap((s) => s.project.technologies));
  const viewedTools = new Set(viewed.flatMap((v) => v.project.technologies));
  const categories = new Set(follows.map((f) => f.category.name));
  return {
    ...data,
    reasons: Object.fromEntries(
      data.projects.map((p) => [
        p.id,
        p.collaboration !== "CLOSED"
          ? "Vic Academy project seeking collaborators."
          : p.technologies.some((t) => savedTools.has(t))
            ? "Similar to projects you bookmarked."
            : p.technologies.some((t) => viewedTools.has(t))
              ? "Recommended because of technologies you recently explored."
              : categories.has(p.category.name)
                ? `New ideas in ${p.category.name}, a subject you follow.`
                : "Recent student work from different disciplines.",
      ]),
    ),
  };
}
