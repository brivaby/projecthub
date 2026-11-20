import { z } from "zod";
import type { Prisma, User } from "@prisma/client";
import { projectInput } from "./validation";
import { HttpError } from "./http-error";
import { verifiedVic } from "./eligibility";
export async function projectWrite(
  tx: Prisma.TransactionClient,
  user: User,
  v: z.infer<typeof projectInput>,
  existing?: { id: string; courseId: string | null; status: string },
) {
  if (!verifiedVic(user))
    throw new HttpError(
      403,
      "Only verified Vine Iternational Christian Academy accounts may publish academic projects.",
    );
  const institution = await tx.institution.upsert({
    where: { name: v.institution.trim() },
    create: { name: v.institution.trim() },
    update: {},
  });
  const category = await tx.category.findUnique({
    where: { name: v.category },
  });
  if (!category) throw new HttpError(422, "Select an existing subject");
  let course = v.courseId
    ? await tx.course.findUnique({ where: { id: v.courseId } })
    : v.course
      ? await tx.course.findUnique({
          where: {
            name_institutionId: {
              name: v.course,
              institutionId: institution.id,
            },
          },
        })
      : null;
  if (v.courseId && !course) throw new HttpError(422, "Course unavailable");
  if (!course && v.course)
    course = await tx.course.create({
      data: { name: v.course, institutionId: institution.id },
    });
  if (course?.teacherId) {
    const member = await tx.courseMembership.findUnique({
      where: { courseId_userId: { courseId: course.id, userId: user.id } },
    });
    if (
      course.teacherId !== user.id &&
      user.role !== "ADMIN" &&
      member?.status !== "APPROVED"
    )
      throw new HttpError(403, "Approved course membership is required");
  }
  if (v.visibility === "COURSE" && !course?.teacherId)
    throw new HttpError(422, "Course-only projects require a managed course");
  if (
    v.visibility === "SCHEDULED" &&
    (!v.scheduledAt || Date.parse(v.scheduledAt) <= Date.now())
  )
    throw new HttpError(422, "Choose a future publication time");
  if (v.license === "Custom" && v.customLicense.trim().length < 20)
    throw new HttpError(422, "Provide the full custom license terms");
  let status = v.status;
  const moderation=await tx.platformSetting.findUnique({where:{key:"moderation"}});if((moderation?.value as {reviewNewProjects?:boolean}|null)?.reviewNewProjects&&user.role!=="ADMIN"&&status==="PUBLISHED")status="PENDING_REVIEW";
  if (
    course?.teacherId &&
    course.teacherId !== user.id &&
    user.role !== "ADMIN" &&
    status === "PUBLISHED"
  )
    status = "PENDING_REVIEW";
  if(existing?.courseId&&existing.courseId!==course?.id){const priorCourse=await tx.course.findUnique({where:{id:existing.courseId}});if(priorCourse?.teacherId&&priorCourse.teacherId!==user.id&&user.role!=='ADMIN')throw new HttpError(403,'A teacher must approve moving a managed-course project');}
  if (existing) {
    const reviewed = await tx.submission.findMany({
      where: { projectId: existing.id, assignment: { requiresReview: true } },
      include: { assignment: { include: { course: true } } },
    });
    const needsReview = reviewed.some(
      (sub) =>
        sub.assignment.course.teacherId !== user.id && user.role !== "ADMIN",
    );
    if (needsReview) {
      await tx.submission.updateMany({
        where: { projectId: existing.id, assignment: { requiresReview: true } },
        data: { status: "SUBMITTED" },
      });
      if (status === "PUBLISHED") status = "PENDING_REVIEW";
    }
  }
  const {
    tags,
    links,
    contributors,
    category: categoryName,
    institution: institutionName,
    course: courseName,
    courseId,
    attestations,
    scheduledAt,
    ...data
  } = v;
  void categoryName;
  void institutionName;
  void courseName;
  void courseId;
  void attestations;
  return {
    ...data,
    status,
    commentsApproval: v.commentPolicy === "MODERATED",
    cloningAllowed: v.clonePolicy !== "DISABLED",
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    rightsConfirmedAt: new Date(),
    institutionId: institution.id,
    categoryId: category.id,
    courseId: course?.id ?? null,
    tags: {
      create: [...new Set(tags)].map((name) => ({
        tag: { connectOrCreate: { where: { name }, create: { name } } },
      })),
    },
    links: { create: links },
    contributors: { create: contributors },
  };
}
