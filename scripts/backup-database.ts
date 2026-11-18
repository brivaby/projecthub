import { spawn } from "node:child_process";
import { mkdir, chmod, writeFile, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path from "node:path";
async function main() {
  process.umask(0o077);
  const encodedKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === "production" && !encodedKey)
    throw new Error("BACKUP_ENCRYPTION_KEY is required in production");
  if (encodedKey && !/^[a-fA-F0-9]{64}$/.test(encodedKey))
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be 32 random bytes encoded as 64 hex characters",
    );
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error("DATABASE_URL is required");
  const url = new URL(connection);
  const directory = path.resolve(
    process.env.BACKUP_DIRECTORY || ".data/backups",
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-"),
    raw = path.join(directory, `vic-projecthub-${stamp}.dump`);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
  };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--file", raw],
      { env, stdio: ["ignore", "ignore", "pipe"] },
    );
    child.stderr.resume();
    child.on("error", () => reject(new Error("pg_dump could not start")));
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "pg_dump failed; inspect protected database monitoring logs",
            ),
          ),
    );
  });
  await chmod(raw, 0o600);
  let destination = raw;
  if (encodedKey) {
    const iv = randomBytes(12),
      cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(encodedKey, "hex"),
        iv,
      );
    destination = `${raw}.enc`;
    await pipeline(
      createReadStream(raw),
      cipher,
      createWriteStream(destination, { mode: 0o600 }),
    );
    await writeFile(
      `${destination}.crypto.json`,
      JSON.stringify({
        algorithm: "aes-256-gcm",
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
      }) + "\n",
      { mode: 0o600 },
    );
    await unlink(raw);
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  await writeFile(`${destination}.sha256`, hash.digest("hex") + "\n", {
    mode: 0o600,
  });
  console.log(
    `Backup written: ${path.basename(destination)}. Copy it and its manifest to a separate protected backup store.`,
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backup failed");
  process.exitCode = 1;
});
