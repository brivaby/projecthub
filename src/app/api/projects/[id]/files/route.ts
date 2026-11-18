import { lockedProject } from "@/lib/locked-project";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { actor, endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
import {
  canAccessProject,
  canManageProject,
  assertWorkspaceAccess,
} from "@/lib/project-access";
import { inspectZip, storageQuota } from "@/lib/archive-safety";
import { validateFile, validateSignature } from "@/lib/validation";
import { put, scan, remove } from "@/lib/storage";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const u = await actor();
  await limit(`upload:${u.id}`, 20, 3600);
  const { id } = await c.params;
  const p = await db.project.findUnique({ where: { id } });
  const collab = await db.collaborator.findUnique({
    where: { projectId_userId: { projectId: id, userId: u.id } },
  });
  if (
    !p ||
    (!(await canManageProject(u, p)) &&
      !["CONTRIBUTOR", "EDITOR", "MANAGER"].includes(collab?.permission || ""))
  )
    throw new HttpError(403, "Upload access required");
  if (!(await canManageProject(u, p))) await assertWorkspaceAccess(u, p);
  if (!(await canAccessProject(u, p)))
    throw new HttpError(404, "Project unavailable");
  if (p.deletedAt || p.archived)
    throw new HttpError(409, "Restore the project before uploading files");
  if (Number(r.headers.get("content-length") || 0) > 26 * 1024 * 1024)
    throw new HttpError(413, "File too large");
  if (!r.body) throw new HttpError(422, "Select a file");
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 26 * 1024 * 1024) {
      await reader.cancel();
      throw new HttpError(413, "File too large");
    }
    chunks.push(value);
  }
  const multipart = new Request(r.url, {
    method: "POST",
    headers: { "Content-Type": r.headers.get("content-type") || "" },
    body: Buffer.concat(chunks),
  });
  const data = await multipart.formData();
  const isCover = data.get("isCover") === "true";
  const f = data.get("file");
  if (!(f instanceof File)) throw new HttpError(422, "Select a file");
  let ext;
  try {
    ext = validateFile(f.name, f.type, f.size);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
  if (isCover && !["image/png", "image/jpeg", "image/webp"].includes(f.type))
    throw new HttpError(422, "Cover must be a PNG, JPEG, or WebP image");
  const bytes = Buffer.from(await f.arrayBuffer());
  try {
    validateSignature(ext, bytes);
    if (["zip", "docx", "pptx", "xlsx"].includes(ext)) inspectZip(bytes);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
  const scanStatus = await scan(bytes);
  if (scanStatus === "REJECTED")
    throw new HttpError(422, "File rejected by malware scanner");
  const key = await put(bytes, f.type);
  try {
    const file = await db.$transaction(async (tx) => {
      await lockedProject(tx,u.id,id,"UPLOAD");
      const used = await tx.projectFile.aggregate({
        where: { projectId: id },
        _sum: { size: true },
      });
      try {
        storageQuota(used._sum.size || 0, f.size);
      } catch (e) {
        throw new HttpError(422, (e as Error).message);
      }
      if (isCover)
        await tx.projectFile.updateMany({
          where: { projectId: id, isCover: true },
          data: { isCover: false },
        });
      return tx.projectFile.create({
        data: {
          projectId: id,
          name: f.name,
          key,
          mime: f.type,
          size: f.size,
          isCover,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          scanStatus,
        },
      });
    });
    return Response.json({ id: file.id, scanStatus }, { status: 201 });
  } catch (e) {
    await remove(key);
    throw e;
  }
});
