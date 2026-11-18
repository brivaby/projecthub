import { db } from "@/lib/db";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const configured =
      process.env.NODE_ENV !== "production" ||
      (process.env.STORAGE_DRIVER === "s3" &&
        process.env.S3_BUCKET &&
        process.env.S3_ACCESS_KEY_ID &&
        process.env.S3_SECRET_ACCESS_KEY &&
        process.env.SMTP_HOST &&
        process.env.AUTH_SECRET &&
        process.env.SCAN_URL &&
        process.env.SCAN_TOKEN);
    return Response.json(
      { status: configured ? "ok" : "degraded", database: "reachable" },
      {
        status: configured ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
