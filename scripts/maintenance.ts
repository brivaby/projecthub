import { PrismaClient } from "@prisma/client";
import { z } from "zod";
const db = new PrismaClient();
const retention = z.object({
  analyticsDays: z.number().int().min(7).max(3650).default(90),
  sentEmailDays: z.number().int().min(1).max(3650).default(30),
  usedChallengeDays: z.number().int().min(1).max(90).default(7),
});
async function main() {
  const setting = await db.platformSetting.findUnique({
      where: { key: "retention" },
    }),
    policy = retention.parse(setting?.value || {}),
    now = new Date();
  const before = (days: number) => new Date(Date.now() - days * 86400000);
  const results = await db.$transaction([
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.session.deleteMany({ where: { expires: { lt: now } } }),
    db.emailChallenge.deleteMany({
      where: { expiresAt: { lt: before(policy.usedChallengeDays) } },
    }),
    db.projectView.deleteMany({
      where: { createdAt: { lt: before(policy.analyticsDays) } },
    }),
    db.viewHistory.deleteMany({
      where: { viewedAt: { lt: before(policy.analyticsDays) } },
    }),
    db.emailEvent.deleteMany({
      where: { status: "SENT", sentAt: { lt: before(policy.sentEmailDays) } },
    }),
    db.request.updateMany({
      where: {
        status: { in: ["PENDING", "NEEDS_INFO"] },
        expiresAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    }),
    db.ownershipTransfer.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED", resolvedAt: now },
    }),
  ]);
  console.log(
    "Maintenance complete:",
    results.map((r) => r.count),
  );
}
main()
  .catch(() => {
    console.error("Maintenance failed; no content purge was performed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
