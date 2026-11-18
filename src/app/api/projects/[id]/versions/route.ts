import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { auth } from "@/auth";
import { canAccessProject, canManageProject } from "@/lib/project-access";
import { collaborationEligible } from "@/lib/eligibility";
import {
  releaseInput,
  releaseAction,
  buildSnapshot,
  contentSnapshot,
  canPublishRelease,
  restoredPublicationState,
} from "@/lib/project-lifecycle";
import { notifyLifecycle } from "@/lib/lifecycle-notifications";
export const GET = endpoint(async (r, c) => {
  const { id } = await c.params;
  const session = await auth();
  const u = session?.user?.id
    ? await db.user.findUnique({ where: { id: session.user.id } })
    : null;
  const project = await db.project.findUnique({ where: { id } });
  if (!project || !(await canAccessProject(u, project)))
    throw new HttpError(404, "Project not found");
  const manager = await canManageProject(u, project);
  const versions = await db.projectVersion.findMany({
    where: { projectId: id, ...(!manager ? { status: "PUBLISHED" } : {}) },
    select: {
      id: true,
      label: true,
      title: true,
      notes: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      author: { select: { id: true, name: true } },
      files: { select: { id: true, name: true, size: true, scanStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(
    { versions },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`release:${u.id}`, 20, 3600);
  const { id } = await c.params;
  const input = releaseInput.parse(await r.json());
  const version = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id} FOR UPDATE`;
    const p = await tx.project.findUnique({
      where: { id },
      include: {
        owners: true,
        course: { select: { teacherId: true } },
        tags: { include: { tag: true } },
        links: true,
        contributors: true,
        collaborators: { include: { user: true } },
        followers: true,
      },
    });
    if (!p || !(await canManageProject(u, p, tx)))
      throw new HttpError(403, "Project owner access required");
    if (p.deletedAt || p.archived)
      throw new HttpError(409, "Restore the project before creating a version");
    if (input.status === "PUBLISHED" && !canPublishRelease(p))
      throw new HttpError(
        409,
        "Confirm publication rights and complete required review before publishing a release",
      );
    const ids = [...new Set(input.fileIds)];
    const files = await tx.projectFile.findMany({
      where: {
        id: { in: ids },
        projectId: id,
        scanStatus: "CLEAN",
        versionId: null,
      },
    });
    if (files.length !== ids.length)
      throw new HttpError(
        422,
        "Select clean, unversioned files belonging to this project",
      );
    const result = await tx.projectVersion.create({
      data: {
        projectId: id,
        label: input.label,
        title: input.title,
        notes: input.notes,
        status: input.status,
        authorId: u.id,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        snapshot: buildSnapshot(p, ids),
      },
    });
    if (ids.length)
      await tx.projectFile.updateMany({
        where: { id: { in: ids }, projectId: id, versionId: null },
        data: { versionId: result.id },
      });
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: `VERSION_${input.status}`,
        targetId: result.id,
      },
    });
    await tx.activity.create({
      data: {
        projectId: id,
        actorId: u.id,
        kind: "VERSION_CREATED",
        public: input.status === "PUBLISHED",
      },
    });
    if (input.status === "PUBLISHED")
      await notifyLifecycle(
        tx,
        [
          p.ownerId,
          ...p.owners.map((o) => o.userId),
          ...p.collaborators
            .filter((c) => collaborationEligible(c.user))
            .map((c) => c.userId),
          ...p.followers.map((f) => f.userId),
        ],
        "VERSION",
        "New project version",
        `${p.title}: ${input.label} — ${input.title}\n${input.notes}`,
        `/projects/${id}/versions`,
        `version:${result.id}`,
      );
    return result;
  });
  return Response.json({ id: version.id }, { status: 201 });
});
export const PATCH = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`version-action:${u.id}`, 20, 3600);
  const { id } = await c.params;
  const input = releaseAction.parse(await r.json());
  let restoredId: string | undefined;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id} FOR UPDATE`;
    const p = await tx.project.findUnique({
      where: { id },
      include: {
        owners: true,
        course: { select: { teacherId: true } },
        collaborators: { include: { user: true } },
        followers: true,
      },
    });
    if (!p || !(await canManageProject(u, p, tx)))
      throw new HttpError(403, "Project owner access required");
    const version = await tx.projectVersion.findFirst({
      where: { id: input.versionId, projectId: id },
    });
    if (!version) throw new HttpError(404, "Version not found");
    if (p.deletedAt || p.archived)
      throw new HttpError(409, "Restore the project first");
    if (input.action === "PUBLISH") {
      if (version.status !== "DRAFT" || !canPublishRelease(p))
        throw new HttpError(
          409,
          "Only reviewed draft versions can be published",
        );
      await tx.projectVersion.update({
        where: { id: version.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      await notifyLifecycle(
        tx,
        [
          p.ownerId,
          ...p.owners.map((o) => o.userId),
          ...p.collaborators
            .filter((c) => collaborationEligible(c.user))
            .map((c) => c.userId),
          ...p.followers.map((f) => f.userId),
        ],
        "VERSION",
        "New project version",
        `${p.title}: ${version.label}\n${version.notes}`,
        `/projects/${id}/versions`,
        `version:${version.id}`,
      );
    } else if (input.action === "ARCHIVE") {
      await tx.projectVersion.update({
        where: { id: version.id },
        data: { status: "ARCHIVED" },
      });
    } else {
      const snapshot = contentSnapshot.parse(version.snapshot);
      const { tags, links, contributors, fileIds, ...content } = snapshot;
      void fileIds;
      await tx.projectTag.deleteMany({ where: { projectId: id } });
      await tx.projectLink.deleteMany({ where: { projectId: id } });
      await tx.contributor.deleteMany({ where: { projectId: id } });
      const requiresReview =
        !!p.course?.teacherId ||
        (await tx.submission.count({
          where: { projectId: id, assignment: { requiresReview: true } },
        })) > 0;
      await tx.submission.updateMany({
        where: { projectId: id, assignment: { requiresReview: true } },
        data: { status: "SUBMITTED", grade: null },
      });
      await tx.project.update({
        where: { id },
        data: {
          ...content,
          ...restoredPublicationState(requiresReview),
          tags: {
            create: tags.map((name) => ({
              tag: { connectOrCreate: { where: { name }, create: { name } } },
            })),
          },
          links: { create: links },
          contributors: { create: contributors },
        },
      });
      const restoration = await tx.projectVersion.create({
        data: {
          projectId: id,
          label: `restore-${Date.now()}`,
          title: `Restore ${version.label}`,
          notes: `Restored project content from ${version.label}. Ownership, visibility, permissions and existing releases were preserved. Publication and teacher review must be confirmed again.`,
          snapshot: version.snapshot!,
          status: "DRAFT",
          authorId: u.id,
        },
      });
      restoredId = restoration.id;
    }
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: `VERSION_${input.action}`,
        targetId: version.id,
      },
    });
    await tx.activity.create({
      data: {
        projectId: id,
        actorId: u.id,
        kind: `VERSION_${input.action}`,
        public: false,
      },
    });
  });
  return Response.json({ ok: true, restoredId });
});
