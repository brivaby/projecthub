import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const N = 32768,
  r = 8,
  p = 1;
function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N, r, p, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128)
    throw new Error("Use a password between 12 and 128 characters");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
) {
  if (!encoded || password.length > 128) return false;
  const [algorithm, n, rounds, parallel, saltHex, keyHex] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    Number(n) !== N ||
    Number(rounds) !== r ||
    Number(parallel) !== p ||
    !/^[a-f0-9]{32}$/.test(saltHex || "") ||
    !/^[a-f0-9]{128}$/.test(keyHex || "")
  )
    return false;
  const key = await derive(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}
