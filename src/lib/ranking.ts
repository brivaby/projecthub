export type Metrics = {
  views: number;
  likes: number;
  bookmarks: number;
  comments: number;
  clones: number;
  collaborations: number;
  publishedAt: Date;
  updatedAt: Date;
};
// Log views to cap traffic advantage. Engagements are unique per account and clones/collaborations require owner approval.
export function popularity(m: Metrics, now = new Date()) {
  const age = Math.max(0, (now.getTime() - m.updatedAt.getTime()) / 86400000);
  return (
    (Math.log1p(m.views) * 2 +
      m.likes * 3 +
      m.bookmarks * 4 +
      m.comments * 2 +
      m.clones * 8 +
      m.collaborations * 10) /
    Math.pow(1 + age / 14, 1.2)
  );
}
export function affinity(
  tags: string[],
  technologies: string[],
  interests: string[],
) {
  const i = new Set(interests.map((x) => x.toLowerCase()));
  return [...tags, ...technologies].reduce(
    (n, t) => n + (i.has(t.toLowerCase()) ? 3 : 0),
    0,
  );
}
export function diversify<T extends { categoryId: string }>(items: T[]) {
  const result: T[] = [];
  const rest = [...items];
  while (rest.length) {
    let i = rest.findIndex((p) => p.categoryId !== result.at(-1)?.categoryId);
    if (i < 0) i = 0;
    result.push(rest.splice(i, 1)[0]);
  }
  return result;
}
