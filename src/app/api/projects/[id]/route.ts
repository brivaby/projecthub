import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canAccessProject, canManageProject } from "@/lib/project-access";
import { projectInput } from "@/lib/validation";
import { projectWrite } from "@/lib/project-write";
import { lockedProject } from "@/lib/locked-project";
import { auth } from "@/auth";
export const GET = endpoint(async (r, c) => {
  const { id } = await c.params;
  const s = await auth();
  const user = s?.user?.id
    ? await db.user.findUnique({ where: { id: s.user.id } })
    : null;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      files: {
        select: {
          id: true,
          name: true,
          size: true,
          scanStatus: true,
          versionId: true,
          version: { select: { status: true } },
        },
      },
      links: true,
      owners: { select: { user: { select: { id: true, name: true } } } },
      versions: {
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          label: true,
          title: true,
          notes: true,
          publishedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!p || !(await canAccessProject(user, p)))
    throw new HttpError(404, "Project not found");
  const manager = await canManageProject(user, p);
  return Response.json(
    {
      ...p,
      files: p.files.filter(
        (f) => manager || !f.version || f.version.status === "PUBLISHED",
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`edit:${user.id}`);
  const { id } = await c.params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p || !(await canManageProject(user, p)))
    throw new HttpError(403, "Project ownership required");
  const v = projectInput.parse(await r.json());
  if (v.originalId !== undefined && v.originalId !== p.originalId)
    throw new HttpError(422, "Original project attribution cannot be changed");
  await db.$transaction(async (tx) => {
    const live=await lockedProject(tx,user.id,id);
    const data = await projectWrite(tx, live.user, v, live.project);
    await tx.projectTag.deleteMany({ where: { projectId: id } });
    await tx.projectLink.deleteMany({ where: { projectId: id } });
    await tx.contributor.deleteMany({ where: { projectId: id } });
    await tx.project.update({ where: { id }, data });
    await tx.auditLog.create({
      data: { actorId: user.id, action: "PROJECT_UPDATED", targetId: id },
    });
  });
  return Response.json({ ok: true });
});
export const DELETE = endpoint(async (r, c) => {
  sameOrigin(r);
  const user = await actor();
  const { id } = await c.params;
  const p = await db.project.findUnique({ where: { id } });
  if (!p || !(await canManageProject(user, p)))
    throw new HttpError(403, "Project ownership required");
  await db.$transaction(async tx=>{await lockedProject(tx,user.id,id);await tx.project.update({where:{id},data:{deletedAt:new Date(),status:'DELETED',visibility:'PRIVATE'}});await tx.auditLog.create({data:{actorId:user.id,action:'PROJECT_DELETED',targetId:id}});});
  return Response.json({ ok: true });
});
