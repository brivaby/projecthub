import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { verifiedVic } from "@/lib/eligibility";
import { emailTemplate } from "@/lib/email";
import { z } from "zod";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("REQUEST") }),
  z.object({
    action: z.literal("INVITE"),
    email: z.string().email().max(254),
    role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
  }),
  z.object({
    action: z.enum(["APPROVE", "REJECT", "REMOVE"]),
    userId: z.string().min(1),
  }),
]);
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await limit(`course-members:${u.id}`, 20, 3600);
  const v = input.parse(await r.json());
  if (v.action === "REQUEST") {
    if (!verifiedVic(u))
      throw new HttpError(
        403,
        "Course enrollment requires a verified Vine Iternational Christian Academy email account",
      );
    const course = await db.course.findFirst({
      where: { id, archived: false },
    });
    if (!course) throw new HttpError(404, "Course unavailable");
    await db.courseMembership.upsert({
      where: { courseId_userId: { courseId: id, userId: u.id } },
      create: {
        courseId: id,
        userId: u.id,
        status: "PENDING",
        role: "STUDENT",
      },
      update: {},
    });
    await db.auditLog.create({
      data: {
        actorId: u.id,
        action: "COURSE_MEMBERSHIP_REQUESTED",
        targetId: id,
      },
    });
    return Response.json({ ok: true });
  }
  const course = await courseAccess(u, id, true);
  if (v.action === "INVITE") {
    const email = v.email.trim().toLowerCase();
    const target = await db.user.findUnique({ where: { email } });
    if (
      target &&
      verifiedVic(target) &&
      !target.suspended &&
      !target.deletedAt &&
      (v.role !== "TEACHER" || ["TEACHER", "ADMIN"].includes(target.role))
    ) {
      await db.$transaction(async (tx) => {
        await tx.courseMembership.upsert({
          where: { courseId_userId: { courseId: id, userId: target.id } },
          create: {
            courseId: id,
            userId: target.id,
            status: "APPROVED",
            role: v.role,
          },
          update: { status: "APPROVED", role: v.role },
        });
        if (target.inAppNotifications)
          await tx.notification.create({
            data: {
              userId: target.id,
              title: `You have been invited to ${course.name}`,
              href: `/courses/${id}`,
            },
          });
        if (target.email && target.emailNotifications)
          await tx.emailEvent.create({
            data: {
              dedupeKey: `course-invite:${id}:${target.id}:${Date.now()}`,
              recipient: target.email,
              subject: `Course invitation: ${course.name}`,
              html: emailTemplate(
                "You are invited to a course",
                `${u.name || "Your teacher"} invited you to ${course.name}.`,
                `${process.env.APP_URL}/courses/${id}`,
              ),
            },
          });
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "COURSE_MEMBER_INVITED",
            targetId: id,
          },
        });
      });
    }
    return Response.json({
      ok: true,
      message:
        "If the verified account is eligible, its course invitation has been recorded.",
    });
  }
  if (v.userId === course.teacherId)
    throw new HttpError(422, "The course owner cannot be removed");
  const membership = await db.courseMembership.findUnique({
    where: { courseId_userId: { courseId: id, userId: v.userId } },
    include: { user: true },
  });
  if (!membership) throw new HttpError(404, "Membership unavailable");
  if (v.action === "APPROVE" && !verifiedVic(membership.user))
    throw new HttpError(
      403,
      "A verified Vine Iternational Christian Academy email account is required",
    );
  await db.$transaction(async (tx) => {
    if (v.action === "REMOVE") {
      const classes = await tx.classGroup.findMany({
        where: { courseId: id },
        select: { id: true },
      });
      await tx.classMember.deleteMany({
        where: {
          userId: v.userId,
          classId: { in: classes.map((group) => group.id) },
        },
      });
      await tx.courseMembership.delete({
        where: { courseId_userId: { courseId: id, userId: v.userId } },
      });
    } else
      await tx.courseMembership.update({
        where: { courseId_userId: { courseId: id, userId: v.userId } },
        data: { status: v.action === "APPROVE" ? "APPROVED" : "REJECTED" },
      });
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: `COURSE_MEMBER_${v.action}`,
        targetId: id,
      },
    });
  });
  return Response.json({ ok: true });
});
