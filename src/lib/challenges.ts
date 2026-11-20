import type { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  challengeHash,
  codeMatches,
  verificationCode,
  challengeState,
  challengeConfig,
  type ChallengePurpose,
} from "./challenge-crypto";
import { emailTemplate } from "./email";
import { encryptEmailBody } from "./email-secrets";
import { HttpError } from "./http-error";
export async function enqueueChallenge(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string,
  purpose: ChallengePurpose,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const config = challengeConfig();
  const recent = await tx.emailChallenge.findFirst({
    where: {
      userId,
      purpose,
      createdAt: { gt: new Date(Date.now() - config.resendSeconds * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return false;
  await tx.emailChallenge.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  const code = verificationCode();
  const minutes = Math.ceil(config.ttlSeconds / 60);
  const challenge = await tx.emailChallenge.create({
    data: {
      userId,
      email,
      purpose,
      secretHash: challengeHash({ userId, email, purpose, code }),
      expiresAt: new Date(Date.now() + config.ttlSeconds * 1000),
    },
  });
  const title =
    purpose === "VERIFY"
      ? "Verify your Vine Iternational Christian Academy ProjectHub account"
      : purpose === "RESET"
        ? "Reset your Vine Iternational Christian Academy ProjectHub password"
        : "Confirm your new email address";
  await tx.emailEvent.create({
    data: {
      dedupeKey: `challenge:${challenge.id}`,
      recipient: email,
      subject: title,
      html: encryptEmailBody(
        emailTemplate(
          title,
          `Your six-digit verification code is ${code}.\nIt expires in ${minutes} minutes and can only be used once. Do not share this code. Ignore this email if you did not request it.`,
          `${process.env.APP_URL}/verify?purpose=${purpose}`,
        ),
      ),
    },
  });
  await tx.auditLog.create({
    data: {
      actorId: userId,
      action: `${purpose}_CODE_ISSUED`,
      targetId: challenge.id,
    },
  });
  return true;
}
export async function consumeChallenge<T>(
  email: string,
  purpose: ChallengePurpose,
  code: string,
  operation: (tx: Prisma.TransactionClient, userId: string) => Promise<T>,
) {
  const result = await db.$transaction(async (tx) => {
    let latest = await tx.emailChallenge.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return { error: "Invalid or expired verification code" };
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${latest.userId} FOR UPDATE`;
    latest = await tx.emailChallenge.findFirst({
      where: { email, purpose, userId: latest.userId },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return { error: "Invalid or expired verification code" };
    await tx.$queryRaw`SELECT id FROM "EmailChallenge" WHERE id=${latest.id} FOR UPDATE`;
    const challenge = await tx.emailChallenge.findUniqueOrThrow({
      where: { id: latest.id },
    });
    const state = challengeState(challenge);
    if (state !== "ACTIVE")
      return {
        error:
          state === "EXPIRED"
            ? "Verification code expired. Request a new code."
            : "Invalid or expired verification code",
      };
    await tx.emailChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    if (
      !codeMatches(challenge.secretHash, {
        userId: challenge.userId,
        email,
        purpose,
        code,
      })
    ) {
      await tx.auditLog.create({
        data: {
          actorId: challenge.userId,
          action: "VERIFICATION_FAILED",
          targetId: challenge.id,
        },
      });
      return { error: "Invalid or expired verification code" };
    }
    await tx.emailChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });
    const value = await operation(tx, challenge.userId);
    await tx.auditLog.create({
      data: {
        actorId: challenge.userId,
        action: `${purpose}_CODE_CONSUMED`,
        targetId: challenge.id,
      },
    });
    return { value };
  });
  if ("error" in result) throw new HttpError(422, result.error!);
  return result.value;
}
