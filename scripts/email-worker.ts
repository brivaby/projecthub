import { flushEmails } from "../src/lib/email";
import { db } from "../src/lib/db";
async function main() {
  console.log("Email worker started");
  while (true) {
    await flushEmails();
    await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
main()
  .catch(() => {
    console.error("Email worker stopped");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
