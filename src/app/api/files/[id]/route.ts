import { lockedProject } from "@/lib/locked-project";
import { db } from "@/lib/db";
import { actor, endpoint, HttpError, sameOrigin } from "@/lib/security";
import {
  canAccessProject,
  canManageProject,
  assertWorkspaceAccess,
  canReviewCourseProject,
} from "@/lib/project-access";
import { download, remove } from "@/lib/storage";
export const GET = endpoint(async (r, c) => {
  const u = await actor();
  const { id } = await c.params;
  const f = await db.projectFile.findUnique({
    where: { id },
    include: {
      project: { include: { collaborators: true } },
      version: { select: { status: true } },
    },
  });
  if (!f || !(await canAccessProject(u, f.project, f.project.collaborators)))
    throw new HttpError(404, "File not found");
  const approved = await db.request.findFirst({
    where: {
      projectId: f.projectId,
      userId: u.id,
      type: "CLONE",
      status: { in: ["ACCEPTED", "COMPLETED"] },
    },
  });
  const manager = await canManageProject(u, f.project);
  if (f.version && f.version.status !== "PUBLISHED" && !manager)
    throw new HttpError(404, "File not found");
  if (!manager && !approved && !(await canReviewCourseProject(u, f.project)))
    await assertWorkspaceAccess(u, f.project);
  if (f.scanStatus !== "CLEAN")
    throw new HttpError(423, "File is quarantined pending malware scan");
  const result = await download(f.key, f.name);
  await db.activity.create({
    data: { projectId: f.projectId, actorId: u.id, kind: "DOWNLOAD" },
  });
  if (result.url) return Response.redirect(result.url);
  return new Response(new Uint8Array(result.bytes!), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${f.name}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

export const DELETE = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  const f = await db.projectFile.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!f || !(await canManageProject(u, f.project)))
    throw new HttpError(403, "Owner access required");
  const key=await db.$transaction(async tx=>{await lockedProject(tx,u.id,f.projectId);const current=await tx.projectFile.findUnique({where:{id}});if(!current)throw new HttpError(404,'File not found');if(current.versionId)throw new HttpError(409,'Version files are immutable; publish a new version instead');await tx.projectFile.delete({where:{id}});await tx.auditLog.create({data:{actorId:u.id,action:'FILE_REMOVED',targetId:f.projectId}});return current.key;});
  await remove(key);
  return Response.json({ ok: true });
});
