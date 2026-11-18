import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import {
  submissionInput,
  reviewInput,
  validateGrade,
  validateSubmissionDeadline,
} from "@/lib/education";
import { canManageProject } from "@/lib/project-access";
import { emailTemplate } from "@/lib/email";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id);
  await limit(`submission:${u.id}`, 20, 3600);
  const v = submissionInput.parse(await r.json());
  const assignment = await db.assignment.findFirst({
    where: { id: v.assignmentId, courseId: id },
  });
  if (!assignment) throw new HttpError(404, "Assignment unavailable");
  validateSubmissionDeadline(assignment.deadline);
  const project = await db.project.findUnique({ where: { id: v.projectId } });
  if (
    !project ||
    project.deletedAt ||
    project.archived ||
    !(await canManageProject(u, project))
  )
    throw new HttpError(403, "Project ownership is required");
  if (project.courseId && project.courseId !== id)
    throw new HttpError(422, "Project belongs to a different course");
  const submission = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${project.id} FOR UPDATE`;
    const old = await tx.submission.findUnique({
      where: {
        assignmentId_projectId: {
          assignmentId: assignment.id,
          projectId: project.id,
        },
      },
    });
    if (old && old.status !== "REJECTED")
      throw new HttpError(409, "Project was already submitted");
    const s = await tx.submission.upsert({
      where: {
        assignmentId_projectId: {
          assignmentId: assignment.id,
          projectId: project.id,
        },
      },
      create: {
        assignmentId: assignment.id,
        projectId: project.id,
        userId: u.id,
        status: "SUBMITTED",
      },
      update: { status: "SUBMITTED", feedback: null, grade: null },
    });
    await tx.project.update({
      where: { id: project.id },
      data: {
        courseId: id,
        ...(assignment.requiresReview
          ? { status: "PENDING_REVIEW", visibility: "PRIVATE" }
          : {}),
      },
    });
    await tx.auditLog.create({
      data: { actorId: u.id, action: "ASSIGNMENT_SUBMITTED", targetId: s.id },
    });
    return s;
  });
  return Response.json({ id: submission.id }, { status: 201 });
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`submission-review:${u.id}`, 30, 3600);
  const v = reviewInput.parse(await r.json());
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Submission" WHERE id=${v.submissionId} FOR UPDATE`;
    const submission = await tx.submission.findFirst({
      where: { id: v.submissionId, assignment: { courseId: id } },
      include: { assignment: true, project: true, user: true },
    });
    if (!submission) throw new HttpError(404, "Submission unavailable");
    validateGrade(v.grade, submission.assignment.maxScore);
    if (
      v.publish &&
      (v.status !== "APPROVED" || !submission.project.rightsConfirmedAt)
    )
      throw new HttpError(
        422,
        "Publication requires approval and the creator’s rights confirmation",
      );
    if (submission.project.deletedAt || submission.project.archived)
      throw new HttpError(
        422,
        "Archived or deleted work cannot be reviewed for publication",
      );
    await tx.submission.update({
      where: { id: submission.id },
      data: { status: v.status, grade: v.grade, feedback: v.feedback },
    });
    if (v.publish)
      await tx.project.update({
        where: { id: submission.projectId },
        data: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          publishedAt: new Date(),
        },
      });
    else if (submission.project.status === "PENDING_REVIEW")
      await tx.project.update({
        where: { id: submission.projectId },
        data: { status: "DRAFT", visibility: "PRIVATE" },
      });
    if (submission.user.inAppNotifications)
      await tx.notification.create({
        data: {
          userId: submission.userId,
          title: `Your course project was reviewed: ${submission.project.title}`,
          href: `/courses/${id}`,
        },
      });
    if (submission.user.email && submission.user.emailNotifications)
      await tx.emailEvent.create({
        data: {
          dedupeKey: `submission-review:${submission.id}:${submission.updatedAt.toISOString()}:${v.status}`,
          recipient: submission.user.email,
          subject: "Your course project has been reviewed",
          html: emailTemplate(
            "Your project review is ready",
            `${submission.project.title} has been reviewed. Sign in to see private feedback.`,
            `${process.env.APP_URL}/courses/${id}`,
          ),
        },
      });
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: `SUBMISSION_${v.status}`,
        targetId: submission.id,
      },
    });
  });
  return Response.json({ ok: true });
});
