import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit } from "@/lib/security";
import { z } from "zod";
import { safeUrl } from "@/lib/validation";
const privacyFields = {
  showInstitution: z.boolean().default(false),
  showDomainBadge: z.boolean().default(false),
  showCollaborations: z.boolean().default(false),
  showAvailability: z.boolean().default(false),
  showInRankings: z.boolean().default(false),
  personalizedRecommendations: z.boolean().default(true),
};
export const PATCH = endpoint(async (r) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`profile:${user.id}`);
  const v = z
    .object({
      name: z.string().trim().min(2).max(100),
      bio: z.string().max(2000),
      institution: z.string().max(160),
      interests: z.array(z.string().max(50)).max(20),
      skills: z.array(z.string().max(50)).max(20),
      technologies: z.array(z.string().max(50)).max(20),
      links: z.array(safeUrl).max(5),
      public: z.boolean(),
      emailNotifications: z.boolean(),
      inAppNotifications: z.boolean(),
      ...privacyFields,
    })
    .parse(await r.json());
  const { name, emailNotifications, inAppNotifications, ...profile } = v;
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        name,
        emailNotifications,
        inAppNotifications,
        profile: { upsert: { create: profile, update: profile } },
      },
    });
    if (!profile.personalizedRecommendations) {
      await tx.viewHistory.deleteMany({ where: { userId: user.id } });
      await tx.recommendation.deleteMany({ where: { userId: user.id } });
    }
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "PRIVACY_PREFERENCES_CHANGED",
        targetId: user.id,
      },
    });
  });
  return Response.json({ ok: true });
});
export const GET = endpoint(async () => {
  const user = await actor();
  const data = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      studentId: true,
      emailVerified: true,
      createdAt: true,
      profile: true,
      consents: true,
      notificationPreferences: true,
      requests: {
        select: {
          id: true,
          projectId: true,
          type: true,
          status: true,
          message: true,
          details: true,
          response: true,
          createdAt: true,
        },
      },
      engagements: true,
      comments: {
        select: {
          id: true,
          projectId: true,
          body: true,
          status: true,
          createdAt: true,
        },
      },
      projects: {
        include: {
          files: {
            select: { id: true, name: true, size: true, versionId: true },
          },
          links: true,
        },
      },
      notifications: true,
      savedSearches: true,
      followedCategories: true,
      viewHistory: true,
    },
  });
  return Response.json(data, {
    headers: {
      "Content-Disposition":
        'attachment; filename="vic-academy-account-export.json"',
      "Cache-Control": "private, no-store",
    },
  });
});
export const DELETE = endpoint(async (r) => {
  sameOrigin(r);
  const user = await actor();
  await limit(`delete:${user.id}`, 3, 3600);
  await db.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });
    for (const ref of projects) {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${ref.id} FOR UPDATE`;
      const p = await tx.project.findUnique({
        where: { id: ref.id },
        include: {
          owners: {
            include: {
              user: { select: { id: true, suspended: true, deletedAt: true } },
            },
          },
        },
      });
      if (!p || p.ownerId !== user.id) continue;
      const successor = p.owners.find(
        (o) => o.userId !== user.id && !o.user.suspended && !o.user.deletedAt,
      );
      if (successor) {
        await tx.project.update({
          where: { id: p.id },
          data: { ownerId: successor.userId },
        });
        await tx.notification.create({
          data: {
            userId: successor.userId,
            title: `Team project preserved: you are now the primary owner of ${p.title}`,
            href: `/projects/${p.id}`,
          },
        });
      } else
        await tx.project.update({
          where: { id: p.id },
          data: { visibility: "PRIVATE", archived: true, status: "ARCHIVED" },
        });
    }
    await tx.projectOwner.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.emailChallenge.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.profile.deleteMany({ where: { userId: user.id } });
    await tx.engagement.deleteMany({ where: { userId: user.id } });
    await tx.collaborator.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.recommendation.deleteMany({ where: { userId: user.id } });
    await tx.viewHistory.deleteMany({ where: { userId: user.id } });
    await tx.followedCategory.deleteMany({ where: { userId: user.id } });
    await tx.projectFollow.deleteMany({ where: { userId: user.id } });
    await tx.savedSearch.deleteMany({ where: { userId: user.id } });
    await tx.notificationPreference.deleteMany({ where: { userId: user.id } });
    await tx.userBlock.deleteMany({
      where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
    });
    await tx.rating.deleteMany({ where: { userId: user.id } });
    await tx.emailEvent.deleteMany({ where: { recipient: user.email || "" } });
    await tx.request.updateMany({
      where: { userId: user.id, status: { in: ["PENDING", "NEEDS_INFO"] } },
      data: { status: "CANCELLED" },
    });
    await tx.ownershipTransfer.updateMany({
      where: {
        status: "PENDING",
        OR: [{ fromUserId: user.id }, { toUserId: user.id }],
      },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });
    await tx.comment.updateMany({
      where: { userId: user.id },
      data: { body: "[deleted]", status: "HIDDEN" },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: "Deleted account",
        email: null,
        studentId: null,
        image: null,
        passwordHash: null,
        deletedAt: new Date(),
        suspended: true,
        collaborationRulesAcceptedAt: null,
      },
    });
    await tx.auditLog.create({
      data: { actorId: user.id, action: "ACCOUNT_DELETED", targetId: user.id },
    });
  });
  return Response.json({ ok: true });
});
