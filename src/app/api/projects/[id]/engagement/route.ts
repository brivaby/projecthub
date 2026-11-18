import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canAccessProject } from "@/lib/project-access";
import { z } from "zod";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`engagement:${u.id}`, 30);
  const { id } = await c.params;
  const { kind } = z
    .object({ kind: z.enum(["LIKE", "BOOKMARK"]) })
    .parse(await r.json());
  const p = await db.project.findUnique({
    where: { id },
    include: { collaborators: true },
  });
  if (!p || !(await canAccessProject(u, p, p.collaborators)))
    throw new HttpError(404, "Project not found");
  const key = { projectId: id, userId: u.id, kind };
  const exists = await db.engagement.findUnique({
    where: { projectId_userId_kind: key },
  });
  if (exists)
    await db.engagement.delete({ where: { projectId_userId_kind: key } });
  else await db.engagement.create({ data: key });
  return Response.json({ active: !exists });
});
