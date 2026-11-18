import { describe, it, expect } from "vitest";
import { canRead, canManage, canDownload, active } from "../src/lib/policies";
import { popularity, affinity, diversify } from "../src/lib/ranking";
import {
  validateFile,
  validateSignature,
  requestInput,
  safeUrl,
  projectInput,
} from "../src/lib/validation";
const user = {
  id: "a",
  email: "student@vicacademy.org",
  emailVerified: new Date(),
  collaborationRulesAcceptedAt: new Date(),
  role: "USER" as const,
  suspended: false,
  deletedAt: null,
};
const admin = { ...user, id: "admin", role: "ADMIN" as const };
const project = {
  ownerId: "a",
  visibility: "PRIVATE" as const,
  deletedAt: null,
  archived: false,
};
describe("Server authorization policy", () => {
  it("hides private projects from visitors and unrelated accounts", () => {
    expect(canRead(null, project)).toBe(false);
    expect(canRead({ ...user, id: "b" }, project)).toBe(false);
  });
  it("allows owners, admins, and approved collaborators", () => {
    expect(canRead(user, project)).toBe(true);
    expect(canRead(admin, project)).toBe(true);
    expect(canRead({ ...user, id: "b" }, project, [{ userId: "b" }])).toBe(
      true,
    );
  });
  it("does not let collaborators manage ownership actions", () =>
    expect(canManage({ ...user, id: "b" }, project)).toBe(false));
  it("allows unlisted pages but never implicitly grants downloads", () => {
    expect(canRead(null, { ...project, visibility: "UNLISTED" })).toBe(true);
    expect(canDownload({ ...user, id: "b" }, project, [])).toBe(false);
    expect(canDownload({ ...user, id: "b" }, project, [], true)).toBe(true);
  });
  it("suspended and deleted accounts lose privileges", () => {
    expect(active({ ...user, suspended: true })).toBe(false);
    expect(canManage({ ...admin, deletedAt: new Date() }, project)).toBe(false);
    expect(canRead({ ...user, suspended: true }, project)).toBe(false);
  });
  it("deleted projects are unavailable to the public", () =>
    expect(
      canRead(null, {
        ...project,
        visibility: "PUBLIC",
        deletedAt: new Date(),
      }),
    ).toBe(false));
});
describe("Secure uploads", () => {
  it.each([
    ["notes.pdf", "application/pdf"],
    ["source.zip", "application/zip"],
    ["readme.md", "text/markdown"],
    [
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ])("allows %s", (name, mime) =>
    expect(validateFile(name, mime, 1024)).toBeTruthy(),
  );
  it.each([
    "../secret.pdf",
    "image.svg",
    "evil.exe",
    "shell.sh",
    "bad\u0000.pdf",
    "/etc/passwd",
    "a..pdf",
  ])("blocks dangerous filename %s", (name) =>
    expect(() => validateFile(name, "application/pdf", 1024)).toThrow(),
  );
  it("rejects mismatched MIME, empty, and oversized files", () => {
    expect(() => validateFile("test.pdf", "text/html", 10)).toThrow();
    expect(() => validateFile("test.pdf", "application/pdf", 0)).toThrow();
    expect(() =>
      validateFile("test.pdf", "application/pdf", 26 * 1024 * 1024),
    ).toThrow();
  });
  it("checks archive and image signatures", () => {
    expect(() => validateSignature("zip", Buffer.from("not a zip"))).toThrow();
    expect(() => validateSignature("png", Buffer.from("<script>"))).toThrow();
    expect(() =>
      validateSignature("pdf", Buffer.from("%PDF-1.7")),
    ).not.toThrow();
    expect(() => validateSignature("txt", Buffer.from([0]))).toThrow();
  });
});
describe("Request validation", () => {
  it("requires informed license agreement for cloning", () => {
    const data = {
      type: "CLONE",
      message: "I would like to study and extend this work.",
      details: {
        reason: "Research",
        intendedUse: "Academic study",
        attributionPlan:
          "Retain original creator and license in every derivative.",
        modifications: "Accessibility improvements",
        visibility: "PRIVATE",
      },
    };
    expect(requestInput.safeParse(data).success).toBe(false);
    expect(
      requestInput.safeParse({
        ...data,
        details: { ...data.details, licenseAgreed: true },
      }).success,
    ).toBe(true);
  });
  it("requires collaboration responsibilities and availability", () =>
    expect(
      requestInput.safeParse({
        type: "COLLABORATION",
        message: "Let us work together",
        details: { skills: "Python" },
      }).success,
    ).toBe(false));
  it("accepts a thoughtful comment request", () =>
    expect(
      requestInput.safeParse({
        type: "COMMENT",
        message: "How did you validate the sensor accuracy?",
        details: {},
      }).success,
    ).toBe(true));
  it("rejects unknown permissions and short comments", () =>
    expect(
      requestInput.safeParse({
        type: "COMMENT",
        message: "x",
        permission: "ADMIN",
        details: {},
      }).success,
    ).toBe(false));
  it.each([
    "not a valid URL",
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
    "https://localhost/a",
  ])("rejects unsafe URL %s", (url) =>
    expect(safeUrl.safeParse(url).success).toBe(false),
  );
  it("accepts public HTTPS links", () =>
    expect(
      safeUrl.safeParse("https://github.com/student/project").success,
    ).toBe(true));
  it("rejects incomplete publishing input", () =>
    expect(projectInput.safeParse({ title: "Hello" }).success).toBe(false));
});
describe("Transparent rankings and recommendations", () => {
  const now = new Date("2026-11-17");
  const base = {
    views: 100,
    likes: 0,
    bookmarks: 0,
    comments: 0,
    clones: 0,
    collaborations: 0,
    publishedAt: now,
    updatedAt: now,
  };
  it("values approved collaboration over raw traffic", () =>
    expect(
      popularity({ ...base, views: 0, collaborations: 5 }, now),
    ).toBeGreaterThan(popularity({ ...base, views: 100000 }, now)));
  it("decays stale activity", () =>
    expect(
      popularity({ ...base, updatedAt: new Date("2025-01-01") }, now),
    ).toBeLessThan(popularity(base, now)));
  it("handles empty and future-dated records safely", () => {
    expect(popularity({ ...base, views: 0 }, now)).toBe(0);
    expect(
      Number.isFinite(
        popularity({ ...base, updatedAt: new Date("2027-01-01") }, now),
      ),
    ).toBe(true);
  });
  it("matches interests without case sensitivity", () =>
    expect(affinity(["Sustainability"], ["Python"], ["python"])).toBe(3));
  it("gives different disciplines exposure", () =>
    expect(
      diversify([
        { categoryId: "a", id: 1 },
        { categoryId: "a", id: 2 },
        { categoryId: "b", id: 3 },
      ]).map((p) => p.id),
    ).toEqual([1, 3, 2]));
});
