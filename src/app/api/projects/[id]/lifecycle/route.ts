import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, HttpError } from "@/lib/security";
import { canManageProject } from "@/lib/project-access";
import { z } from "zod";
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p || !(await canManageProject(u, p)))
    throw new HttpError(403, "Owner access required");
  const v = z
    .object({ action: z.enum(["ARCHIVE", "UNARCHIVE", "UNPUBLISH"]) })
    .parse(await r.json());
  await db.$transaction([
    db.project.update({
      where: { id },
      data:
        v.action === "UNPUBLISH"
          ? { visibility: "PRIVATE", status: "DRAFT" }
          : {
              archived: v.action === "ARCHIVE",
              status: v.action === "ARCHIVE" ? "ARCHIVED" : "DRAFT",
            },
    }),
    db.auditLog.create({
      data: { actorId: u.id, targetId: id, action: v.action },
    }),
  ]);
  return Response.json({ ok: true });
});
