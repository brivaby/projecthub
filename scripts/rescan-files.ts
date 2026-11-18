import { db } from "../src/lib/db";
import { download, scan } from "../src/lib/storage";
async function main() {
  if (!process.env.SCAN_URL)
    throw new Error("Configure SCAN_URL before rescanning");
  const files = await db.projectFile.findMany({
    where: { scanStatus: "PENDING" },
    take: 100,
  });
  for (const file of files) {
    const stored = await download(file.key, file.name);
    let bytes = stored.bytes;
    if (stored.url) {
      const response = await fetch(stored.url, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error("Unable to read quarantined object");
      bytes = Buffer.from(await response.arrayBuffer());
    }
    const status = await scan(bytes!);
    await db.projectFile.update({
      where: { id: file.id },
      data: { scanStatus: status },
    });
  }
  console.log(`Scanned ${files.length} quarantined files`);
}
main()
  .catch(() => {
    console.error("Scanning failed; files remain quarantined");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
