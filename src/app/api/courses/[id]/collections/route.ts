import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import { courseAccess } from "@/lib/education-access";
import { z } from "zod";
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE"),
    title: z.string().trim().min(3).max(180),
    public: z.boolean().default(false),
  }),
  z.object({
    action: z.enum(["ADD", "REMOVE"]),
    collectionId: z.string().min(1),
    projectId: z.string().min(1),
  }),
]);
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  const { id } = await c.params;
  await courseAccess(u, id, true);
  await limit(`course-collection:${u.id}`, 30, 3600);
  const v = input.parse(await r.json());
  if (v.action === "CREATE") {
    const collection = await db.courseCollection.create({
      data: { courseId: id, title: v.title, public: v.public },
    });
    await db.auditLog.create({
      data: {
        actorId: u.id,
        action: "COURSE_COLLECTION_CREATED",
        targetId: collection.id,
      },
    });
    return Response.json({ id: collection.id }, { status: 201 });
  }
  const collection = await db.courseCollection.findFirst({
    where: { id: v.collectionId, courseId: id },
  });
  if (!collection) throw new HttpError(404, "Collection unavailable");
  if (v.action === "ADD") {
    const project = await db.project.findFirst({
      where: {
        id: v.projectId,
        courseId: id,
        deletedAt: null,
        archived: false,
      },
    });
    if (!project) throw new HttpError(404, "Course project unavailable");
    if (
      collection.public &&
      (project.visibility !== "PUBLIC" || project.status !== "PUBLISHED")
    )
      throw new HttpError(
        422,
        "Public showcases may include only published public work",
      );
    await db.collectionProject.upsert({
      where: {
        collectionId_projectId: {
          collectionId: collection.id,
          projectId: project.id,
        },
      },
      create: { collectionId: collection.id, projectId: project.id },
      update: {},
    });
  } else
    await db.collectionProject.deleteMany({
      where: { collectionId: collection.id, projectId: v.projectId },
    });
  await db.auditLog.create({
    data: {
      actorId: u.id,
      action: `COURSE_COLLECTION_${v.action}`,
      targetId: collection.id,
    },
  });
  return Response.json({ ok: true });
});
