import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  challenge: null as null | {
    id: string;
    userId: string;
    email: string;
    purpose: string;
    secretHash: string;
    expiresAt: Date;
    attempts: number;
    usedAt: Date | null;
  },
  events: [] as unknown[],
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  query: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $queryRaw: mock.query,
        emailChallenge: {
          findFirst: mock.findFirst,
          findUniqueOrThrow: mock.findUniqueOrThrow,
          update: mock.update,
          updateMany: mock.updateMany,
          create: mock.create,
        },
        emailEvent: { create: async (v: unknown) => mock.events.push(v) },
        auditLog: { create: mock.audit },
      }),
  },
}));
vi.mock("../src/lib/email", () => ({
  emailTemplate: (_title: string, message: string) => `<p>${message}</p>`,
}));
import { consumeChallenge, enqueueChallenge } from "../src/lib/challenges";
import { challengeHash } from "../src/lib/challenge-crypto";
import { decryptEmailBody } from "../src/lib/email-secrets";
const secret = "test-only-secure-challenge-secret-1234567";
beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", secret);
  vi.clearAllMocks();
  mock.events = [];
  mock.challenge = {
    id: "challenge",
    userId: "student",
    email: "student@vicacademy.org",
    purpose: "VERIFY",
    secretHash: challengeHash(
      {
        userId: "student",
        email: "student@vicacademy.org",
        purpose: "VERIFY",
        code: "001234",
      },
      secret,
    ),
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
    usedAt: null,
  };
  mock.findFirst.mockImplementation(async () => mock.challenge);
  mock.findUniqueOrThrow.mockImplementation(async () => mock.challenge);
  mock.update.mockImplementation(
    async ({
      data,
    }: {
      data: { attempts?: { increment: number }; usedAt?: Date };
    }) => {
      if (mock.challenge) {
        if (data.attempts) mock.challenge.attempts += data.attempts.increment;
        if (data.usedAt) mock.challenge.usedAt = data.usedAt;
      }
      return mock.challenge;
    },
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("Persisted challenge service contract (mocked database)", () => {
  it("increments incorrect attempts before returning a validation error", async () => {
    await expect(
      consumeChallenge(
        "student@vicacademy.org",
        "VERIFY",
        "999999",
        async () => true,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(mock.challenge?.attempts).toBe(1);
    expect(mock.audit).toHaveBeenCalledWith({
      data: {
        actorId: "student",
        action: "VERIFICATION_FAILED",
        targetId: "challenge",
      },
    });
  });
  it("locks after five attempts and never runs the account mutation", async () => {
    mock.challenge!.attempts = 5;
    const operation = vi.fn();
    await expect(
      consumeChallenge("student@vicacademy.org", "VERIFY", "001234", operation),
    ).rejects.toMatchObject({ status: 422 });
    expect(operation).not.toHaveBeenCalled();
  });
  it("consumes a valid challenge once and rejects replay", async () => {
    const operation = vi.fn(async () => true);
    await expect(
      consumeChallenge("student@vicacademy.org", "VERIFY", "001234", operation),
    ).resolves.toBe(true);
    expect(mock.challenge?.usedAt).toBeInstanceOf(Date);
    await expect(
      consumeChallenge("student@vicacademy.org", "VERIFY", "001234", operation),
    ).rejects.toMatchObject({ status: 422 });
    expect(operation).toHaveBeenCalledOnce();
  });
  it("rejects expired codes before invoking account changes", async () => {
    mock.challenge!.expiresAt = new Date(Date.now() - 1);
    const operation = vi.fn();
    await expect(
      consumeChallenge("student@vicacademy.org", "VERIFY", "001234", operation),
    ).rejects.toThrow("expired");
    expect(operation).not.toHaveBeenCalled();
  });
  it("does not issue another code during the resend cooldown", async () => {
    const tx = {
      $queryRaw: mock.query,
      emailChallenge: {
        findFirst: mock.findFirst,
        updateMany: mock.updateMany,
        create: mock.create,
      },
    };
    await expect(
      enqueueChallenge(
        tx as never,
        "student",
        "student@vicacademy.org",
        "VERIFY",
      ),
    ).resolves.toBe(false);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("invalidates older codes and queues only encrypted email material", async () => {
    mock.findFirst.mockResolvedValue(null);
    mock.create.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: "new-challenge",
      ...(data as object),
    }));
    const tx = {
      $queryRaw: mock.query,
      emailChallenge: {
        findFirst: mock.findFirst,
        updateMany: mock.updateMany,
        create: mock.create,
      },
      emailEvent: { create: async (v: unknown) => mock.events.push(v) },
      auditLog: { create: mock.audit },
    };
    await expect(
      enqueueChallenge(
        tx as never,
        "student",
        "student@vicacademy.org",
        "VERIFY",
      ),
    ).resolves.toBe(true);
    expect(mock.updateMany).toHaveBeenCalledWith({
      where: { userId: "student", purpose: "VERIFY", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    const message = mock.events[0] as { data: { html: string } };
    expect(message.data.html).toMatch(/^enc:v1:/);
    expect(decryptEmailBody(message.data.html)).toMatch(
      /six-digit verification code is \d{6}/,
    );
    expect(mock.create.mock.calls[0][0].data.secretHash).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
