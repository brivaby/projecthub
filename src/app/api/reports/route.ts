import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { canAccessProject } from "@/lib/project-access";
import { z } from "zod";
import { emailTemplate } from "@/lib/email";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`report:${user.id}`, 5, 3600);
  const v = z
    .object({
      targetId: z.string().min(1).max(100),
      targetType: z.enum(["PROJECT", "COMMENT", "USER"]),
      category: z
        .enum([
          "GENERAL",
          "COPYRIGHT",
          "TAKEDOWN",
          "INTEGRITY",
          "OWNERSHIP",
          "HARASSMENT",
          "MALWARE",
        ])
        .default("GENERAL"),
      reason: z.string().trim().min(10).max(4000),
    })
    .parse(await r.json());
  let projectId: string | undefined;
  if (v.targetType === "PROJECT") projectId = v.targetId;
  else if (v.targetType === "COMMENT") {
    const comment = await db.comment.findUnique({
      where: { id: v.targetId },
      select: { projectId: true },
    });
    if (!comment) throw new HttpError(404, "Content unavailable");
    projectId = comment.projectId;
  } else if (
    !(await db.user.findFirst({ where: { id: v.targetId, deletedAt: null } }))
  )
    throw new HttpError(404, "User unavailable");
  const project = projectId
    ? await db.project.findUnique({
        where: { id: projectId },
        include: { owner: true, owners: { include: { user: true } } },
      })
    : null;
  if (projectId && (!project || !(await canAccessProject(user, project))))
    throw new HttpError(404, "Content unavailable");
  await db.$transaction(async (tx) => {
    const report = await tx.report.create({ data: { ...v, userId: user.id } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: `REPORT_${v.category}`,
        targetId: report.id,
      },
    });
    if (project) {
      const recipients = [
        ...new Map(
          [project.owner, ...project.owners.map((o) => o.user)].map((u) => [
            u.id,
            u,
          ]),
        ).values(),
      ];
      for (const owner of recipients) {
        if (owner.email && owner.emailNotifications)
          await tx.emailEvent.create({
            data: {
              dedupeKey: `report:${report.id}:${owner.id}`,
              recipient: owner.email,
              subject: "Project report received",
              html: emailTemplate(
                "Project report received",
                `A report concerning ${project.title} has been received. The moderation team will review it. No action has been taken solely because of this report.`,
                `${process.env.APP_URL}/projects/${project.id}`,
              ),
            },
          });
        if (owner.inAppNotifications)
          await tx.notification.create({
            data: {
              userId: owner.id,
              title: `A report concerning ${project.title} is under review`,
              href: `/projects/${project.id}`,
            },
          });
      }
    }
  });
  return Response.json({ ok: true }, { status: 201 });
});
