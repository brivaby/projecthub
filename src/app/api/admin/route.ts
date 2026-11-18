import { db } from "@/lib/db";
import { admin, endpoint, sameOrigin,limit,HttpError } from "@/lib/security";
import { z } from "zod";
import { emailTemplate } from "@/lib/email";
export const POST = endpoint(async (r) => {
  sameOrigin(r);
  const u = await admin();
  await limit(`admin:${u.id}`,30,60);
  const v = z
    .object({
      action: z.enum([
        "ROLE",
        "APPROVE_PROJECT",
        "REMOVE_PROJECT",
        "FEATURE",
        "UNFEATURE",
        "HIDE_PROJECT",
        "RESTORE_PROJECT",
        "SUSPEND",
        "UNSUSPEND",
        "HIDE_COMMENT",
        "APPROVE_COMMENT",
        "RESOLVE_REPORT",
        "CATEGORY",
        "TAG",
      ]),
      role:z.enum(["USER","TEACHER","ADMIN"]).optional(),
      targetId: z.string().min(1).max(160),
      reason: z.string().min(5).max(1000),
    })
    .parse(await r.json());
  await db.$transaction(async (tx) => {
    switch (v.action) {
      case 'ROLE':{if(!v.role)throw new HttpError(422,'Select a role');if(v.targetId===u.id)throw new HttpError(403,'Administrators cannot change their own role');const target=await tx.user.findUnique({where:{id:v.targetId}});if(!target||!target.emailVerified||target.suspended||target.deletedAt)throw new HttpError(422,'Choose an active verified account');await tx.user.update({where:{id:v.targetId},data:{role:v.role}});await tx.session.deleteMany({where:{userId:v.targetId}});break;}
      case 'APPROVE_PROJECT':{const project=await tx.project.findUnique({where:{id:v.targetId}});if(!project?.rightsConfirmedAt)throw new HttpError(422,'Publication rights must be confirmed');await tx.project.update({where:{id:v.targetId},data:{status:'PUBLISHED',archived:false}});break;}
      case 'REMOVE_PROJECT':await tx.project.update({where:{id:v.targetId},data:{status:'REMOVED',visibility:'PRIVATE',archived:true}});break;
      case "FEATURE":
      case "UNFEATURE": {
        const project = await tx.project.findUniqueOrThrow({
          where: { id: v.targetId },
          include: { owner: true },
        });
        await tx.project.update({
          where: { id: v.targetId },
          data: { featured: v.action === "FEATURE" },
        });
        if (v.action === "FEATURE" && !project.featured) {
          if (project.owner.inAppNotifications)
            await tx.notification.create({
              data: {
                userId: project.ownerId,
                title: `Your project was featured: ${project.title}`,
                href: `/projects/${project.id}`,
              },
            });
          if (project.owner.email && project.owner.emailNotifications)
            await tx.emailEvent.create({
              data: {
                dedupeKey: `featured:${project.id}:${project.updatedAt.toISOString()}`,
                recipient: project.owner.email,
                subject: "Your project has been featured",
                html: emailTemplate(
                  "Your project has been featured",
                  `Congratulations! ${project.title} is being highlighted in the ProjectHub community.`,
                  `${process.env.APP_URL}/projects/${project.id}`,
                ),
              },
            });
        }
        break;
      }
      case "HIDE_PROJECT":
      case "RESTORE_PROJECT":
        await tx.project.update({
          where: { id: v.targetId },
          data: { archived: v.action === "HIDE_PROJECT",status:v.action==='HIDE_PROJECT'?'SUSPENDED':'DRAFT',...(v.action==='RESTORE_PROJECT'?{deletedAt:null,visibility:'PRIVATE' as const}:{}) },
        });
        break;
      case "SUSPEND":
      case "UNSUSPEND":
        await tx.user.update({
          where: { id: v.targetId },
          data: { suspended: v.action === "SUSPEND" },
        });
        await tx.session.deleteMany({ where: { userId: v.targetId } });
        if (v.action === "SUSPEND")
          await tx.project.updateMany({
            where: { ownerId: v.targetId },
            data: { archived: true },
          });
        break;
      case "HIDE_COMMENT":
      case "APPROVE_COMMENT":
        await tx.comment.update({
          where: { id: v.targetId },
          data: { status: v.action === "HIDE_COMMENT" ? "HIDDEN" : "PUBLIC" },
        });
        break;
      case "RESOLVE_REPORT":
        await tx.report.update({
          where: { id: v.targetId },
          data: { status: "RESOLVED" },
        });
        break;
      case "CATEGORY":
        await tx.category.upsert({
          where: { name: v.targetId },
          create: { name: v.targetId },
          update: {},
        });
        break;
      case "TAG":
        await tx.tag.upsert({
          where: { name: v.targetId },
          create: { name: v.targetId },
          update: {},
        });
        break;
    }
    await tx.moderationAction.create({
      data: {
        adminId: u.id,
        targetId: v.targetId,
        action: v.action,
        reason: v.reason,
      },
    });
    await tx.auditLog.create({
      data: { actorId: u.id, action: v.action, targetId: v.targetId },
    });
  });
  return Response.json({ ok: true });
});
