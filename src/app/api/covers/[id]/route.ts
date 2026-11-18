import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canAccessProject,canManageProject } from "@/lib/project-access";
import { endpoint, HttpError } from "@/lib/security";
import { download } from "@/lib/storage";
export const GET = endpoint(async (r, c) => {
  const { id } = await c.params;
  const f = await db.projectFile.findUnique({
    where: { id },
    include: {
      version:{select:{status:true}},
      project: {
        include: {
          collaborators: true,
          owner: { select: { suspended: true, deletedAt: true } },
        },
      },
    },
  });
  if (
    !f ||
    !f.isCover ||
    f.scanStatus !== "CLEAN" ||
    !["image/png", "image/jpeg", "image/webp"].includes(f.mime)
  )
    throw new HttpError(404, "Cover not found");
  const s = await auth();
  const u = s?.user?.id
    ? await db.user.findUnique({ where: { id: s.user.id } })
    : null;
  if (
    !(await canAccessProject(u, f.project, f.project.collaborators)) ||
    f.project.owner.suspended ||
    f.project.owner.deletedAt
  )
    throw new HttpError(404, "Cover not found");
  if(f.version&&f.version.status!=="PUBLISHED"&&!await canManageProject(u,f.project))throw new HttpError(404,"Cover not found");
  const data = await download(f.key, f.name);
  if (data.url) return Response.redirect(data.url);
  return new Response(new Uint8Array(data.bytes!), {
    headers: {
      "Content-Type": f.mime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
