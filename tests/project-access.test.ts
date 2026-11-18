import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  owners: vi.fn(),
  membership: vi.fn(),
  course: vi.fn(),
  member: vi.fn(),
  members: vi.fn(),
  block: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  db: {
    projectOwner: { findUnique: mocks.owner, findMany: mocks.owners },
    courseMembership: { findFirst: mocks.membership },
    course: { findFirst: mocks.course },
    collaborator: { findUnique: mocks.member, findMany: mocks.members },
    userBlock: { findFirst: mocks.block },
  },
}));
import {
  canAccessProject,
  canReviewCourseProject,
  assertWorkspaceAccess,
} from "../src/lib/project-access";
const student = {
  id: "student",
  email: "student@vicacademy.org",
  emailVerified: new Date(),
  collaborationRulesAcceptedAt: new Date(),
  suspended: false,
  deletedAt: null,
  role: "USER" as const,
};
const project = {
  id: "project",
  ownerId: "owner",
  courseId: "course",
  visibility: "COURSE",
  status: "PUBLISHED",
  archived: false,
  deletedAt: null,
  scheduledAt: null,
} as never;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue(null);
  mocks.owners.mockResolvedValue([]);
  mocks.membership.mockResolvedValue(null);
  mocks.course.mockResolvedValue(null);
  mocks.member.mockResolvedValue(null);
  mocks.members.mockResolvedValue([]);
  mocks.block.mockResolvedValue(null);
});
describe("Live project and workspace authorization context", () => {
  it("does not preserve course access after the current address changes outside Vic Academy", async () => {
    mocks.membership.mockResolvedValue({ status: "APPROVED" });
    expect(
      await canAccessProject(
        { ...student, email: "student@example.test" },
        project,
      ),
    ).toBe(false);
    expect(await canAccessProject(student, project)).toBe(true);
  });
  it("grants assigned teachers scoped pending-review read access without ownership", async () => {
    mocks.course.mockResolvedValue({ id: "course" });
    const pending = {
      ...(project as object),
      status: "PENDING_REVIEW",
    } as never;
    expect(
      await canReviewCourseProject({ ...student, role: "TEACHER" }, pending),
    ).toBe(true);
    expect(
      await canAccessProject({ ...student, role: "TEACHER" }, pending),
    ).toBe(true);
    expect(
      await canReviewCourseProject({ ...student, role: "TEACHER" }, {
        ...(project as object),
        status: "DRAFT",
      } as never),
    ).toBe(false);
  });
  it("does not let unrelated or ordinary student accounts use teacher review scope", async () => {
    expect(
      await canReviewCourseProject({ ...student, role: "TEACHER" }, project),
    ).toBe(false);
    mocks.course.mockResolvedValue({ id: "course" });
    expect(await canReviewCourseProject(student, project)).toBe(false);
  });
  it("does not give a global administrator unapproved workspace membership", async () => {
    await expect(
      assertWorkspaceAccess({ ...student, role: "ADMIN" }, project),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("requires active approval and eligibility before entering a workspace", async () => {
    await expect(assertWorkspaceAccess(student, project)).rejects.toMatchObject(
      { status: 403 },
    );
    mocks.member.mockResolvedValue({ userId: "student" });
    await expect(assertWorkspaceAccess(student, project)).resolves.toBe(true);
    await expect(
      assertWorkspaceAccess({ ...student, emailVerified: null }, project),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("denies blocked membership and removed project workspace access", async () => {
    mocks.member.mockResolvedValue({ userId: "student" });
    mocks.block.mockResolvedValue({ blockerId: "owner", blockedId: "student" });
    await expect(assertWorkspaceAccess(student, project)).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      assertWorkspaceAccess(student, {
        ...(project as object),
        deletedAt: new Date(),
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });
});
