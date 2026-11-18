import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  return createHash("sha256").update(`vic-email-outbox:${secret}`).digest();
}
export function encryptEmailBody(html: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(html, "utf8"),
    cipher.final(),
  ]);
  return `enc:v1:${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptEmailBody(body: string) {
  if (!body.startsWith("enc:v1:")) {
    if (body.startsWith("enc:")) throw new Error("Unsupported encrypted email");
    return body;
  }
  const [iv, tag, encrypted] = body.slice(7).split(".");
  if (!iv || !tag || !encrypted || body.slice(7).split(".").length !== 3)
    throw new Error("Invalid encrypted email");
  for (const value of [iv, tag, encrypted])
    if (
      !/^[A-Za-z0-9_-]+$/.test(value) ||
      Buffer.from(value, "base64url").toString("base64url") !== value
    )
      throw new Error("Invalid encrypted email");
  if (
    Buffer.from(iv, "base64url").length !== 12 ||
    Buffer.from(tag, "base64url").length !== 16
  )
    throw new Error("Invalid encrypted email");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
