import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { endpoint, sameOrigin, limit, HttpError } from "@/lib/security";
export const POST = endpoint(async (r, c) => {
  sameOrigin(r);
  const { id } = await c.params;
  const p = await db.project.findFirst({
    where: {
      id,
      visibility: "PUBLIC",
      status: "PUBLISHED",
      deletedAt: null,
      archived: false,
      owner: { suspended: false, deletedAt: null },
    },
  });
  if (!p) throw new HttpError(404, "Project not found");
  if (/bot|crawler|spider|headless/i.test(r.headers.get("user-agent") || ""))
    return Response.json({ ok: true });
  const secret = process.env.ANALYTICS_SECRET;
  if (!secret) throw new HttpError(503, "Analytics is not configured");
  const hmac = (v: string) =>
    createHmac("sha256", secret).update(v).digest("hex");
  let cookie =
    (r.headers.get("cookie") || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("ph-viewer="))
      ?.slice(10) || "";
  const [token, signature] = cookie.split(".");
  const expected = hmac(token || "");
  if (
    !token ||
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    const value = randomUUID();
    cookie = `${value}.${hmac(value)}`;
  }
  const session = await auth();
  const day = new Date().toISOString().slice(0, 10);
  const identity = session?.user?.id || cookie.split(".")[0];
  const hash = hmac(day + identity);
  // Only trust this header when the operator's reverse proxy overwrites it.
  const source =
    process.env.TRUST_PROXY === "true"
      ? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      : undefined;
  if (source) await limit(`view-source:${hmac(source)}`, 120, 3600);
  await limit(`view:${hash}`, 120, 3600);
  const input = await r.json().catch(() => ({}));
  let referrer: string | null = null;
  try {
    if (typeof input.referrer === "string")
      referrer = new URL(input.referrer).hostname.slice(0, 255);
  } catch {}
  await db.projectView.upsert({
    where: {
      projectId_visitorHash_day: { projectId: id, visitorHash: hash, day },
    },
    create: { projectId: id, visitorHash: hash, day, referrer },
    update: { totalViews: { increment: 1 } },
  });
  if (session?.user?.id) {
    const profile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });
    if (profile?.personalizedRecommendations !== false)
      await db.viewHistory.upsert({
        where: { userId_projectId: { userId: session.user.id, projectId: id } },
        create: { userId: session.user.id, projectId: id },
        update: { viewedAt: new Date() },
      });
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `ph-viewer=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      },
    },
  );
});
