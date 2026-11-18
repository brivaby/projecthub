import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { assignmentInput } from "@/lib/education";
import { z } from "zod";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`course-assignment:${u.id}`, 20, 3600);
  const v = assignmentInput.parse(await r.json());
  const assignment = await db.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        ...v,
        courseId: id,
        deadline: v.deadline ? new Date(v.deadline) : null,
      },
    });
    await tx.auditLog.create({
      data: { actorId: u.id, action: "ASSIGNMENT_CREATED", targetId: a.id },
    });
    return a;
  });
  return Response.json({ id: assignment.id }, { status: 201 });
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`course-assignment-edit:${u.id}`, 20, 3600);
  const raw = await r.json();
  const { assignmentId } = z
    .object({ assignmentId: z.string().min(1) })
    .parse(raw);
  const v = assignmentInput.parse(raw);
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, courseId: id },
  });
  if (!assignment) throw new HttpError(404, "Assignment unavailable");
  const grades = await db.submission.aggregate({
    where: { assignmentId },
    _max: { grade: true },
  });
  if ((grades._max.grade ?? 0) > v.maxScore)
    throw new HttpError(
      422,
      "The new maximum cannot be lower than an already-recorded grade",
    );
  await db.$transaction([
    db.assignment.update({
      where: { id: assignmentId },
      data: { ...v, deadline: v.deadline ? new Date(v.deadline) : null },
    }),
    db.auditLog.create({
      data: {
        actorId: u.id,
        action: "ASSIGNMENT_UPDATED",
        targetId: assignmentId,
      },
    }),
  ]);
  return Response.json({ ok: true });
});
