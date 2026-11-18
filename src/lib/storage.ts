import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "node:path";
function client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
}
function local() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local storage is development-only");
  return path.join(process.cwd(), ".data", "uploads");
}
export async function put(bytes: Buffer, mime: string) {
  const key = randomUUID();
  if (process.env.STORAGE_DRIVER === "s3") {
    await client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: mime,
      }),
    );
  } else {
    const dir = local();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), bytes, { mode: 0o600 });
  }
  return key;
}
export async function download(key: string, name: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid object key");
  if (process.env.STORAGE_DRIVER === "s3")
    return {
      url: await getSignedUrl(
        client(),
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${name}"`,
        }),
        { expiresIn: 60 },
      ),
    };
  return { bytes: await readFile(path.join(local(), key)) };
}
export async function remove(key: string) {
  if (process.env.STORAGE_DRIVER === "s3")
    await client().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
  else await unlink(path.join(local(), key)).catch(() => {});
}
export async function scan(bytes: Buffer) {
  if (process.env.SCAN_URL) {
    const response = await fetch(process.env.SCAN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SCAN_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("Scanner unavailable");
    const result = await response.json();
    return result.clean === true ? "CLEAN" : "REJECTED";
  }
  return "PENDING";
}
