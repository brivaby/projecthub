import { describe, it, expect, vi, afterEach } from "vitest";
import {
  collaborationEligible,
  verifiedVic,
  normalizedEmail,
} from "../src/lib/eligibility";
import {
  verificationCode,
  challengeHash,
  codeMatches,
  challengeState,
} from "../src/lib/challenge-crypto";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { encryptEmailBody, decryptEmailBody } from "../src/lib/email-secrets";
import { assertRequestDecision } from "../src/lib/request-decisions";
const eligible = {
  id: "student",
  email: "student@vicacademy.org",
  emailVerified: new Date(),
  collaborationRulesAcceptedAt: new Date(),
  suspended: false,
  deletedAt: null,
};
const secret = "test-only-independent-secret-1234567890";
afterEach(() => vi.unstubAllEnvs());
describe("Exact verified Vic Academy collaboration eligibility", () => {
  it("normalizes the actual email address", () => {
    expect(normalizedEmail(" Student@VicAcademy.org ")).toBe(
      "student@vicacademy.org",
    );
    expect(
      collaborationEligible({ ...eligible, email: " Student@VICACADEMY.ORG " }),
    ).toBe(true);
  });
  it.each([
    "student@vicacademy.org.evil.test",
    "student@evilvicacademy.org",
    "student@vicacademy.com",
    "student@sub.vicacademy.org",
    "student@vicacademy.org.",
    "student@@vicacademy.org",
    "student＠vicacademy.org",
    "student@vіcacademy.org",
    "student@example.test",
  ])("rejects deceptive or external address %s", (email) =>
    expect(collaborationEligible({ ...eligible, email })).toBe(false),
  );
  it("requires verified current address and explicit rules consent", () => {
    expect(verifiedVic({ ...eligible, emailVerified: null })).toBe(false);
    expect(
      collaborationEligible({
        ...eligible,
        collaborationRulesAcceptedAt: null,
      }),
    ).toBe(false);
  });
  it("never treats an administrator role as a domain override", () =>
    expect(
      collaborationEligible({
        ...eligible,
        email: "admin@example.test",
        ...{ role: "ADMIN" },
      }),
    ).toBe(false));
  it("blocks suspended and deleted accounts", () => {
    expect(collaborationEligible({ ...eligible, suspended: true })).toBe(false);
    expect(collaborationEligible({ ...eligible, deletedAt: new Date() })).toBe(
      false,
    );
    expect(collaborationEligible(null)).toBe(false);
  });
});
describe("Six-digit single-purpose email challenges", () => {
  it("generates exactly six numeric digits including leading zeros", () => {
    for (let i = 0; i < 1000; i++)
      expect(verificationCode()).toMatch(/^\d{6}$/);
  });
  it("uses keyed hashes bound to user, email and purpose", () => {
    const input = {
      userId: "one",
      email: "one@vicacademy.org",
      purpose: "VERIFY",
      code: "001234",
    };
    const hash = challengeHash(input, secret);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("001234");
    expect(codeMatches(hash, input, secret)).toBe(true);
    expect(codeMatches(hash, { ...input, code: "111111" }, secret)).toBe(false);
    expect(codeMatches(hash, { ...input, purpose: "RESET" }, secret)).toBe(
      false,
    );
    expect(
      codeMatches(hash, { ...input, email: "two@vicacademy.org" }, secret),
    ).toBe(false);
    expect(codeMatches(hash, { ...input, userId: "two" }, secret)).toBe(false);
  });
  it("rejects malformed codes and missing signing secrets", () => {
    expect(
      codeMatches(
        "a".repeat(64),
        {
          userId: "one",
          email: "one@vicacademy.org",
          purpose: "VERIFY",
          code: "12345",
        },
        secret,
      ),
    ).toBe(false);
    expect(() =>
      challengeHash(
        {
          userId: "one",
          email: "one@vicacademy.org",
          purpose: "VERIFY",
          code: "123456",
        },
        "short",
      ),
    ).toThrow();
  });
  it("enforces expiry, attempt limits and single use", () => {
    const now = new Date();
    const code = {
      usedAt: null,
      attempts: 0,
      expiresAt: new Date(now.getTime() + 1000),
    };
    expect(challengeState(code, now)).toBe("ACTIVE");
    expect(challengeState({ ...code, expiresAt: now }, now)).toBe("EXPIRED");
    expect(challengeState({ ...code, attempts: 5 }, now)).toBe("LOCKED");
    expect(challengeState({ ...code, usedAt: now }, now)).toBe("USED");
  });
  it("encrypts pending verification messages and rejects tampering", () => {
    vi.stubEnv("AUTH_SECRET", secret);
    const encrypted = encryptEmailBody("Your code is 001234");
    expect(encrypted).not.toContain("001234");
    expect(decryptEmailBody(encrypted)).toBe("Your code is 001234");
    expect(decryptEmailBody("Ordinary public notification")).toBe(
      "Ordinary public notification",
    );
    expect(() =>
      decryptEmailBody(
        encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A"),
      ),
    ).toThrow();
  });
});
describe("Memory-hard password hashing", () => {
  it("hashes with a random salt and verifies only the correct password", async () => {
    const password = "a long unique test passphrase";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("another long password", first)).toBe(false);
  });
  it("bounds password sizes and rejects malformed hashes", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
    expect(await verifyPassword("anything", "scrypt$9999999$8$1$abc$def")).toBe(
      false,
    );
    expect(await verifyPassword("x".repeat(129), null)).toBe(false);
  });
});
describe("Formal request state transitions", () => {
  it("allows owner acceptance and requester cancellation while pending", () => {
    expect(() =>
      assertRequestDecision({
        current: "PENDING",
        next: "ACCEPTED",
        owner: true,
        requester: false,
        response: "",
      }),
    ).not.toThrow();
    expect(() =>
      assertRequestDecision({
        current: "PENDING",
        next: "CANCELLED",
        owner: false,
        requester: true,
        response: "",
      }),
    ).not.toThrow();
  });
  it("prevents repeated approvals and completion before acceptance", () => {
    expect(() =>
      assertRequestDecision({
        current: "ACCEPTED",
        next: "ACCEPTED",
        owner: true,
        requester: false,
        response: "",
      }),
    ).toThrow();
    expect(() =>
      assertRequestDecision({
        current: "PENDING",
        next: "COMPLETED",
        owner: true,
        requester: false,
        response: "",
      }),
    ).toThrow();
  });
  it("requires the requester and enough information to resubmit", () => {
    expect(() =>
      assertRequestDecision({
        current: "NEEDS_INFO",
        next: "PENDING",
        owner: false,
        requester: true,
        response: "I can contribute every Saturday.",
      }),
    ).not.toThrow();
    expect(() =>
      assertRequestDecision({
        current: "NEEDS_INFO",
        next: "PENDING",
        owner: false,
        requester: true,
        response: "short",
      }),
    ).toThrow();
    expect(() =>
      assertRequestDecision({
        current: "NEEDS_INFO",
        next: "PENDING",
        owner: true,
        requester: false,
        response: "This is enough information.",
      }),
    ).toThrow();
  });
  it("denies unrelated users, even when a transition is otherwise valid", () =>
    expect(() =>
      assertRequestDecision({
        current: "PENDING",
        next: "ACCEPTED",
        owner: false,
        requester: false,
        response: "",
      }),
    ).toThrow());
});
