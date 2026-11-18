import { db } from "./db";
import { auth } from "@/auth";
export { limit } from "./rate-limit";
import { HttpError } from "./http-error";
export { HttpError } from "./http-error";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
export async function actor() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "Sign in to continue");
  const u = await db.user.findUnique({ where: { id: session.user.id } });
  if (!u || u.suspended || u.deletedAt || !u.emailVerified)
    throw new HttpError(403, "Account unavailable");
  return u;
}
export async function admin() {
  const u = await actor();
  if (u.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required");
  return u;
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    !origin ||
    origin !== new URL(process.env.APP_URL || "http://127.0.0.1:3000").origin
  )
    throw new HttpError(403, "Invalid request origin");
}

export function endpoint(
  fn: (
    r: Request,
    c: { params: Promise<Record<string, string>> },
  ) => Promise<Response>,
) {
  return async (r: Request, c: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(r, c);
    } catch (e) {
      if (e instanceof ZodError)
        return Response.json(
          {
            error: {
              code: "VALIDATION",
              message: "Check the form fields",
              fields: e.flatten(),
            },
          },
          { status: 422 },
        );
      if (e instanceof HttpError)
        return Response.json(
          { error: { code: String(e.status), message: e.message } },
          { status: e.status },
        );
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      )
        return Response.json(
          {
            error: {
              code: "CONFLICT",
              message: "This action was already recorded",
            },
          },
          { status: 409 },
        );
      console.error("Request failed", e instanceof Error ? e.name : "Unknown");
      return Response.json(
        {
          error: {
            code: "INTERNAL",
            message: "Unable to complete this request",
          },
        },
        { status: 500 },
      );
    }
  };
}
export async function audit(actorId: string, action: string, targetId: string) {
  await db.auditLog.create({ data: { actorId, action, targetId } });
}
