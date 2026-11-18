import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, HttpError, limit } from "@/lib/security";
import { z } from "zod";
import { canAccessProject,canManageProject,blockedBetween } from "@/lib/project-access";
import { verifiedVic } from "@/lib/eligibility";
import { notifyRequest } from "@/lib/request-notifications";
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`comment-edit:${u.id}`);
  const { id } = await c.params;
  const v = z
    .object({ body: z.string().trim().min(2).max(4000) })
    .parse(await r.json());
  const comment = await db.comment.findUnique({
    where: { id },
    include: { project: { include: { owner: true } } },
  });
  if (!comment || comment.userId !== u.id)
    throw new HttpError(403, "Author access required");
  if(!await canAccessProject(u,comment.project))throw new HttpError(404,"Project unavailable");
  if(comment.project.commentPolicy==='DISABLED'||(comment.project.commentPolicy==='VIC_ONLY'&&!verifiedVic(u)))throw new HttpError(403,"Comment editing unavailable");
  if(await blockedBetween(u.id,[comment.project.ownerId]))throw new HttpError(403,"Comment editing unavailable");
  if (comment.status !== "PUBLIC")
    throw new HttpError(403, "Comment is moderated");
  if (comment.project.commentPolicy==='MODERATED' && !await canManageProject(u,comment.project)) {
    await db.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          projectId: comment.projectId,
          userId: u.id,
          type: "COMMENT",
          message: v.body,
          details: { editCommentId: id },
        },
      });
      await notifyRequest(tx, request, u, comment.project);
    });
  } else await db.comment.update({ where: { id }, data: { body: v.body } });
  return Response.json({ ok: true });
});
export const DELETE = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  const comment = await db.comment.findUnique({
    where: { id },
    include: { project: { include: { owner: true } } },
  });
  if (
    !comment ||
    !(
      comment.userId === u.id ||
      await canManageProject(u,comment.project)
    )
  )
    throw new HttpError(403, "Access denied");
  await db.comment.update({
    where: { id },
    data: { body: "[removed]", status: "HIDDEN" },
  });
  return Response.json({ ok: true });
});
