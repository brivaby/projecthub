import { beforeEach, describe, it, expect, vi } from "vitest";
import { HttpError } from "../src/lib/http-error";
const state = vi.hoisted(() => ({
  user: {
    id: "student",
    role: "USER",
    email: "student@vicacademy.org",
    emailVerified: new Date(),
    collaborationRulesAcceptedAt: new Date(),
    suspended: false,
    deletedAt: null,
  } as Record<string, unknown>,
  assignmentFind: vi.fn(),
  membershipFind: vi.fn(),
  classFind: vi.fn(),
  collectionFind: vi.fn(),
  projectFind: vi.fn(),
  ownersFind: vi.fn(),
  collaboratorFind: vi.fn(),
  tasksFind: vi.fn(),
  courseAccess: vi.fn(),
  workspaceAccess: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  db: {
    assignment: { findMany: state.assignmentFind },
    courseMembership: { findMany: state.membershipFind },
    classGroup: { findMany: state.classFind },
    courseCollection: { findMany: state.collectionFind },
    project: { findUnique: state.projectFind },
    projectOwner: { findMany: state.ownersFind },
    collaborator: { findUnique: state.collaboratorFind },
    workspaceTask: { findMany: state.tasksFind },
  },
}));
vi.mock("../src/lib/security", () => ({
  HttpError,
  actor: async () => state.user,
  limit: async () => {},
  sameOrigin: () => {},
  endpoint:
    (fn: (r: Request, c: unknown) => Promise<Response>) =>
    async (r: Request, c: unknown) => {
      try {
        return await fn(r, c);
      } catch (e) {
        if (e instanceof HttpError)
          return Response.json({ error: e.message }, { status: e.status });
        throw e;
      }
    },
}));
vi.mock("../src/lib/education-access", () => ({
  courseAccess: state.courseAccess,
}));
vi.mock("../src/lib/project-access", () => ({
  canAccessProject: async () => true,
  assertWorkspaceAccess: state.workspaceAccess,
  blockedBetween: async () => false,
}));
vi.mock("../src/lib/eligibility", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/eligibility")>(
    "../src/lib/eligibility",
  );
  return {
    ...actual,
    assertCollaborationEligible: async () => {
      if (!actual.collaborationEligible(state.user))
        throw new HttpError(403, actual.COLLABORATION_RESTRICTION);
      return state.user;
    },
  };
});
import { GET as courseGET } from "../src/app/api/courses/[id]/route";
import { GET as tasksGET } from "../src/app/api/projects/[id]/tasks/route";
const context = { params: Promise.resolve({ id: "course" }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.user = {
    id: "student",
    role: "USER",
    email: "student@vicacademy.org",
    emailVerified: new Date(),
    collaborationRulesAcceptedAt: new Date(),
    suspended: false,
    deletedAt: null,
  };
  state.courseAccess.mockResolvedValue({
    id: "course",
    name: "Capstone",
    description: "Course",
    teacherId: "teacher",
    archived: false,
    memberships: [{ userId: "student", role: "STUDENT", status: "APPROVED" }],
  });
  state.assignmentFind.mockResolvedValue([]);
  state.membershipFind.mockResolvedValue([]);
  state.classFind.mockResolvedValue([]);
  state.collectionFind.mockResolvedValue([]);
  state.projectFind.mockResolvedValue({
    id: "course",
    ownerId: "owner",
    status: "PUBLISHED",
    deletedAt: null,
    archived: false,
  });
  state.ownersFind.mockResolvedValue([]);
  state.collaboratorFind.mockResolvedValue({ permission: "VIEWER" });
  state.tasksFind.mockResolvedValue([]);
  state.workspaceAccess.mockResolvedValue(true);
});
describe("Course route privacy boundaries", () => {
  it("filters grades and roster to the authenticated student in database queries", async () => {
    const response = await courseGET(
      new Request("http://127.0.0.1:3000/api/courses/course"),
      context,
    );
    expect(response.status).toBe(200);
    expect(
      state.assignmentFind.mock.calls[0][0].include.submissions.where,
    ).toEqual({ userId: "student" });
    expect(state.membershipFind.mock.calls[0][0].where).toMatchObject({
      userId: "student",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("lets the owning teacher review course submissions but unrelated teachers rely on a denied access guard", async () => {
    state.user = { ...state.user, id: "teacher", role: "TEACHER" };
    await courseGET(
      new Request("http://127.0.0.1:3000/api/courses/course"),
      context,
    );
    expect(
      state.assignmentFind.mock.calls[0][0].include.submissions.where,
    ).toEqual({});
    state.courseAccess.mockRejectedValueOnce(
      new HttpError(404, "Course unavailable"),
    );
    const result = await courseGET(
      new Request("http://127.0.0.1:3000/api/courses/course"),
      context,
    );
    expect(result.status).toBe(404);
  });
  it("never includes private project metadata in a public collection", async () => {
    state.collectionFind.mockResolvedValue([
      {
        id: "collection",
        title: "Showcase",
        public: true,
        projects: [
          {
            project: {
              id: "private",
              title: "Secret",
              summary: "Secret",
              visibility: "PRIVATE",
              status: "DRAFT",
              deletedAt: null,
              archived: false,
            },
          },
          {
            project: {
              id: "public",
              title: "Open research",
              summary: "Public",
              visibility: "PUBLIC",
              status: "PUBLISHED",
              deletedAt: null,
              archived: false,
            },
          },
        ],
      },
    ]);
    const response = await courseGET(
      new Request("http://127.0.0.1:3000/api/courses/course"),
      context,
    );
    const body = await response.json();
    expect(body.collections[0].projects).toEqual([
      { project: { id: "public", title: "Open research", summary: "Public" } },
    ]);
    expect(JSON.stringify(body)).not.toContain("Secret");
  });
});
describe("Workspace task route eligibility and permission boundaries", () => {
  it("rejects outside-domain users before querying task contents", async () => {
    state.user = { ...state.user, email: "student@example.test" };
    const response = await tasksGET(
      new Request("http://127.0.0.1:3000/api/projects/course/tasks"),
      context,
    );
    expect(response.status).toBe(403);
    expect(state.tasksFind).not.toHaveBeenCalled();
  });
  it("gives viewers read-only tasks and no administrative role shortcut", async () => {
    state.user = { ...state.user, role: "ADMIN" };
    const response = await tasksGET(
      new Request("http://127.0.0.1:3000/api/projects/course/tasks"),
      context,
    );
    expect((await response.json()).canEdit).toBe(false);
  });
  it("reports contributor editing permission only after the shared access guard", async () => {
    state.collaboratorFind.mockResolvedValue({ permission: "CONTRIBUTOR" });
    const response = await tasksGET(
      new Request("http://127.0.0.1:3000/api/projects/course/tasks"),
      context,
    );
    expect((await response.json()).canEdit).toBe(true);
    expect(state.workspaceAccess).toHaveBeenCalledOnce();
  });
});
