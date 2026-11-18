import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canAccessProject } from "@/lib/project-access";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`follow:${u.id}`, 20, 3600);
  const { id } = await c.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project || !(await canAccessProject(u, project)))
    throw new HttpError(404, "Project not found");
  const existing = await db.projectFollow.findUnique({
    where: { userId_projectId: { userId: u.id, projectId: id } },
  });
  if (existing)
    await db.projectFollow.delete({
      where: { userId_projectId: { userId: u.id, projectId: id } },
    });
  else await db.projectFollow.create({ data: { userId: u.id, projectId: id } });
  return Response.json({ following: !existing });
});
