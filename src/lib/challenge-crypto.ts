import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
export type ChallengePurpose = "VERIFY" | "RESET" | "EMAIL_CHANGE";
export function verificationCode() {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}
export function challengeHash(
  input: { userId: string; email: string; purpose: string; code: string },
  secret = process.env.AUTH_SECRET,
) {
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET must contain at least 32 characters");
  return createHmac("sha256", secret)
    .update(`${input.userId}|${input.email}|${input.purpose}|${input.code}`)
    .digest("hex");
}
export function codeMatches(
  hash: string,
  input: Parameters<typeof challengeHash>[0],
  secret?: string,
) {
  if (!/^\d{6}$/.test(input.code) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const expected = challengeHash(input, secret);
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(expected, "hex"),
  );
}
export function challengeState(
  challenge: { usedAt: Date | null; expiresAt: Date; attempts: number },
  now = new Date(),
) {
  if (challenge.usedAt) return "USED";
  if (challenge.expiresAt <= now) return "EXPIRED";
  if (challenge.attempts >= challengeConfig().maxAttempts) return "LOCKED";
  return "ACTIVE";
}

export function challengeConfig() {
  const bounded = (
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) => Math.max(min, Math.min(max, Math.floor(Number(value) || fallback)));
  return {
    ttlSeconds: bounded(process.env.VERIFICATION_TTL_SECONDS, 600, 120, 1800),
    maxAttempts: bounded(process.env.VERIFICATION_MAX_ATTEMPTS, 5, 1, 10),
    resendSeconds: bounded(
      process.env.VERIFICATION_RESEND_SECONDS,
      60,
      30,
      300,
    ),
  };
}
