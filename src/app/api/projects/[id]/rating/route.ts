import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canAccessProject } from "@/lib/project-access";
import { z } from "zod";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`rating:${u.id}`, 10, 3600);
  const { id } = await c.params;
  const { score } = z
    .object({ score: z.number().int().min(1).max(5) })
    .parse(await r.json());
  const p = await db.project.findUnique({
    where: { id },
    include: { collaborators: true },
  });
  if (!p || !(await canAccessProject(u, p, p.collaborators)))
    throw new HttpError(404, "Project not found");
  if (p.ownerId === u.id)
    throw new HttpError(422, "You cannot rate your own project");
  await db.rating.upsert({
    where: { projectId_userId: { projectId: id, userId: u.id } },
    create: { projectId: id, userId: u.id, score },
    update: { score },
  });
  return Response.json({ ok: true });
});
