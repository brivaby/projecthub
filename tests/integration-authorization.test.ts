import { beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  canManage: vi.fn(),
  workspace: vi.fn(),
  canAccess: vi.fn(),
  auth: vi.fn(),
  file: vi.fn(),
  user: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../src/lib/project-access", () => ({
  canManageProject: state.canManage,
  assertWorkspaceAccess: state.workspace,
  canAccessProject: state.canAccess,
}));
vi.mock("../src/lib/db", () => ({
  db: {
    projectFile: { findUnique: state.file },
    user: { findUnique: state.user },
  },
}));
vi.mock("../src/auth", () => ({ auth: state.auth }));
vi.mock("../src/lib/storage", () => ({ download: state.download }));
// Error-response plumbing is a test seam; production uses the real common endpoint wrapper.
vi.mock("../src/lib/security", () => ({
  HttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  endpoint:
    (
      fn: (
        r: Request,
        c: { params: Promise<Record<string, string>> },
      ) => Promise<Response>,
    ) =>
    async (r: Request, c: { params: Promise<Record<string, string>> }) => {
      try {
        return await fn(r, c);
      } catch (error) {
        return Response.json(
          { error: { message: (error as Error).message } },
          { status: (error as { status?: number }).status || 500 },
        );
      }
    },
}));
import { lockedProject } from "../src/lib/locked-project";
import { GET as cover } from "../src/app/api/covers/[id]/route";
const user = {
  id: "student",
  email: "student@vicacademy.org",
  emailVerified: new Date(),
  collaborationRulesAcceptedAt: new Date(),
  role: "USER",
  suspended: false,
  deletedAt: null,
};
const project = {
  id: "project",
  ownerId: "student",
  status: "PUBLISHED",
  visibility: "PUBLIC",
  archived: false,
  deletedAt: null,
};
function transaction(
  currentUser: object | null = user,
  currentProject: object | null = project,
) {
  return {
    $queryRaw: vi.fn(async () => []),
    user: { findUnique: vi.fn(async () => currentUser) },
    project: { findUnique: vi.fn(async () => currentProject) },
    collaborator: {
      findUnique: vi.fn(async () => ({ permission: "CONTRIBUTOR" })),
    },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.canManage.mockResolvedValue(true);
  state.workspace.mockResolvedValue(true);
  state.canAccess.mockResolvedValue(true);
  state.auth.mockResolvedValue(null);
  state.user.mockResolvedValue(user);
  state.download.mockResolvedValue({ bytes: Buffer.from("image bytes") });
});
describe("Locked mutation authorization (mocked transaction context)", () => {
  it("locks the project before the user and authorizes fresh transaction records", async () => {
    const tx = transaction();
    await expect(
      lockedProject(tx as never, "student", "project"),
    ).resolves.toMatchObject({ user, project });
    const calls = tx.$queryRaw.mock.calls as unknown as [
      TemplateStringsArray,
      string,
    ][];
    expect(calls[0][0].join("")).toContain('"Project"');
    expect(calls[1][0].join("")).toContain('"User"');
    expect(state.canManage).toHaveBeenCalledWith(user, project, tx);
  });
  it("rejects a previous owner after the locked project has transferred", async () => {
    const tx = transaction(user, { ...project, ownerId: "new-owner" });
    state.canManage.mockResolvedValue(false);
    await expect(
      lockedProject(tx as never, "student", "project"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each([
    { suspended: true },
    { deletedAt: new Date() },
    { emailVerified: null },
  ])("rejects live account revocation %j", async (change) => {
    const tx = transaction({ ...user, ...change });
    await expect(
      lockedProject(tx as never, "student", "project"),
    ).rejects.toMatchObject({ status: 403 });
    expect(state.canManage).not.toHaveBeenCalled();
  });
  it("rejects an email changed outside Vic Academy during upload", async () => {
    const tx = transaction({ ...user, email: "student@example.test" });
    await expect(
      lockedProject(tx as never, "student", "project", "UPLOAD"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a project archived during an in-progress upload", async () => {
    const tx = transaction(user, { ...project, archived: true });
    await expect(
      lockedProject(tx as never, "student", "project", "UPLOAD"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rechecks workspace membership using the same transaction client", async () => {
    const tx = transaction();
    state.canManage.mockResolvedValue(false);
    state.workspace.mockRejectedValue(
      Object.assign(new Error("Membership revoked"), { status: 403 }),
    );
    await expect(
      lockedProject(tx as never, "student", "project", "UPLOAD"),
    ).rejects.toMatchObject({ status: 403 });
    expect(state.workspace).toHaveBeenCalledWith(user, project, tx);
  });
  it("rejects a downgraded viewer before file creation", async () => {
    const tx = transaction();
    tx.collaborator.findUnique.mockResolvedValue({ permission: "VIEWER" });
    state.canManage.mockResolvedValue(false);
    await expect(
      lockedProject(tx as never, "student", "project", "UPLOAD"),
    ).rejects.toMatchObject({ status: 403 });
  });
});
describe("Draft release cover isolation (route with mocked adapters)", () => {
  const request = new Request("http://127.0.0.1:3000/api/covers/cover");
  const context = { params: Promise.resolve({ id: "cover" }) };
  function file(status: string | null) {
    return {
      id: "cover",
      key: "private-object",
      name: "cover.png",
      mime: "image/png",
      isCover: true,
      scanStatus: "CLEAN",
      version: status ? { status } : null,
      project: {
        ...project,
        collaborators: [],
        owner: { suspended: false, deletedAt: null },
      },
    };
  }
  it("does not release a draft version image to a public visitor", async () => {
    state.file.mockResolvedValue(file("DRAFT"));
    state.canManage.mockResolvedValue(false);
    expect((await cover(request, context)).status).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });
  it("allows a published release cover after project visibility checks", async () => {
    state.file.mockResolvedValue(file("PUBLISHED"));
    state.canManage.mockResolvedValue(false);
    expect((await cover(request, context)).status).toBe(200);
    expect(state.download).toHaveBeenCalledWith("private-object", "cover.png");
  });
  it("allows an authorized owner to preview their draft cover", async () => {
    state.file.mockResolvedValue(file("DRAFT"));
    state.auth.mockResolvedValue({ user: { id: "student" } });
    expect((await cover(request, context)).status).toBe(200);
  });
  it("does not expose quarantined files, including to owners", async () => {
    state.file.mockResolvedValue({
      ...file("PUBLISHED"),
      scanStatus: "PENDING",
    });
    expect((await cover(request, context)).status).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });
  it("denies covers when the underlying project is no longer visible", async () => {
    state.file.mockResolvedValue(file("PUBLISHED"));
    state.canAccess.mockResolvedValue(false);
    expect((await cover(request, context)).status).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });
});
