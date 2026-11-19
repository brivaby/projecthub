import { test, expect, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
const db = new PrismaClient();
const origin = process.env.APP_URL || "http://127.0.0.1:3000";
const browserOptions = {
  baseURL: origin,
  ignoreHTTPSErrors: Boolean(process.env.PROJECTHUB_TEST_TLS_CERT),
};
async function authenticated(context: BrowserContext, userId: string) {
  const raw = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      sessionToken: createHash("sha256").update(raw).digest("hex"),
      userId,
      expires: new Date(Date.now() + 3600000),
    },
  });
  await context.addCookies([
    {
      name: "vic-session",
      value: raw,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test.afterAll(() => db.$disconnect());
test("teachers review student work without exposing private grades or accepting outsiders", async ({
  browser,
}) => {
  const suffix = randomBytes(8).toString("hex");
  const now = new Date();
  const teacher = await db.user.create({
    data: {
      name: "Synthetic Teacher",
      email: `teacher-${suffix}@vicacademy.org`,
      emailVerified: now,
      role: "TEACHER",
      termsAcceptedAt: now,
      communityAcceptedAt: now,
      privacyAcceptedAt: now,
      collaborationRulesAcceptedAt: now,
    },
  });
  const student = await db.user.create({
    data: {
      name: "Synthetic Student",
      email: `student-${suffix}@vicacademy.org`,
      emailVerified: now,
      termsAcceptedAt: now,
      communityAcceptedAt: now,
      privacyAcceptedAt: now,
      collaborationRulesAcceptedAt: now,
    },
  });
  const outsider = await db.user.create({
    data: {
      name: "Synthetic Public Visitor",
      email: `public-${suffix}@example.test`,
      emailVerified: now,
      termsAcceptedAt: now,
      communityAcceptedAt: now,
      privacyAcceptedAt: now,
    },
  });
  const teacherContext = await browser.newContext(browserOptions);
  const studentContext = await browser.newContext(browserOptions);
  const outsiderContext = await browser.newContext(browserOptions);
  await authenticated(teacherContext, teacher.id);
  await authenticated(studentContext, student.id);
  await authenticated(outsiderContext, outsider.id);
  let courseId: string | undefined;
  let projectId: string | undefined;
  let categoryId: string | undefined;
  let institutionId: string | undefined;
  try {
    const create = await teacherContext.request.post("/api/courses", {
      headers: { origin },
      data: {
        name: `Capstone ${suffix}`,
        institution: `Vic Academy Test ${suffix}`,
        description:
          "Synthetic course for real persistence integration checks.",
      },
    });
    expect(create.status()).toBe(201);
    courseId = (await create.json()).id;
    expect(
      (await outsiderContext.request.get(`/api/courses/${courseId}`)).status(),
    ).toBe(404);
    expect(
      (
        await outsiderContext.request.post(`/api/courses/${courseId}/members`, {
          headers: { origin },
          data: { action: "REQUEST" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await studentContext.request.post(`/api/courses/${courseId}/members`, {
          headers: { origin },
          data: { action: "REQUEST" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await studentContext.request.get(`/api/courses/${courseId}`)).status(),
    ).toBe(404);
    expect(
      (
        await teacherContext.request.post(`/api/courses/${courseId}/members`, {
          headers: { origin },
          data: { action: "APPROVE", userId: student.id },
        })
      ).status(),
    ).toBe(200);
    const assignment = await teacherContext.request.post(
      `/api/courses/${courseId}/assignments`,
      {
        headers: { origin },
        data: {
          title: "Original research",
          description:
            "Research a problem, build a prototype, and document the results.",
          maxScore: 100,
          requiresReview: true,
          rubric: [
            { criterion: "Evidence", points: 40 },
            { criterion: "Execution", points: 60 },
          ],
        },
      },
    );
    expect(assignment.status()).toBe(201);
    const assignmentId = (await assignment.json()).id;
    expect(
      (
        await studentContext.request.post(
          `/api/courses/${courseId}/assignments`,
          { headers: { origin }, data: { title: "Forged teacher action" } },
        )
      ).status(),
    ).toBe(404);
    const course = await db.course.findUniqueOrThrow({
      where: { id: courseId },
    });
    institutionId = course.institutionId;
    const category = await db.category.create({
      data: { name: `Education integration ${suffix}` },
    });
    categoryId = category.id;
    const project = await db.project.create({
      data: {
        title: `Research ${suffix}`,
        summary:
          "A synthetic academic project created for a real authorization test.",
        description:
          "A documented research project. This fixture tests course review and private grades against real PostgreSQL persistence.",
        ownerId: student.id,
        categoryId: category.id,
        institutionId: course.institutionId,
        courseId: course.id,
        academicLevel: "Secondary",
        projectType: "Research",
        technologies: ["Research"],
        visibility: "PRIVATE",
        status: "DRAFT",
        rightsConfirmedAt: now,
      },
    });
    projectId = project.id;
    const submission = await studentContext.request.post(
      `/api/courses/${courseId}/submissions`,
      { headers: { origin }, data: { assignmentId, projectId } },
    );
    expect(submission.status()).toBe(201);
    const submissionId = (await submission.json()).id;
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).status,
    ).toBe("PENDING_REVIEW");
    expect(
      (
        await outsiderContext.request.patch(
          `/api/courses/${courseId}/submissions`,
          {
            headers: { origin },
            data: {
              submissionId,
              status: "APPROVED",
              grade: 100,
              publish: true,
            },
          },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await teacherContext.request.patch(
          `/api/courses/${courseId}/submissions`,
          {
            headers: { origin },
            data: {
              submissionId,
              status: "APPROVED",
              grade: 88,
              feedback: `Private assessment ${suffix}`,
              publish: true,
            },
          },
        )
      ).status(),
    ).toBe(200);
    const own = await (
      await studentContext.request.get(`/api/courses/${courseId}`)
    ).json();
    expect(own.assignments[0].submissions[0].grade).toBe(88);
    expect(
      (
        await outsiderContext.request.get(`/api/courses/${courseId}/export`)
      ).status(),
    ).toBe(404);
    const exported = await teacherContext.request.get(
      `/api/courses/${courseId}/export`,
    );
    expect(exported.status()).toBe(200);
    expect(await exported.text()).toContain(`Private assessment ${suffix}`);
    expect(exported.headers()["cache-control"]).toContain("no-store");
    const collection = await teacherContext.request.post(
      `/api/courses/${courseId}/collections`,
      {
        headers: { origin },
        data: {
          action: "CREATE",
          title: `Public showcase ${suffix}`,
          public: true,
        },
      },
    );
    expect(collection.status()).toBe(201);
    const collectionId = (await collection.json()).id;
    expect(
      (
        await teacherContext.request.post(
          `/api/courses/${courseId}/collections`,
          {
            headers: { origin },
            data: { action: "ADD", collectionId, projectId },
          },
        )
      ).status(),
    ).toBe(200);
    const page = await outsiderContext.newPage();
    await page.goto(`/courses/showcases/${collectionId}`);
    await expect(
      page.getByRole("heading", { name: `Research ${suffix}` }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      `Private assessment ${suffix}`,
    );
    await db.project.update({
      where: { id: projectId },
      data: { visibility: "PRIVATE" },
    });
    await page.reload();
    await expect(page.locator(".project-card")).toHaveCount(0);
  } finally {
    await Promise.all([
      teacherContext.close(),
      studentContext.close(),
      outsiderContext.close(),
    ]);
    if (projectId) await db.project.deleteMany({ where: { id: projectId } });
    if (courseId) await db.course.deleteMany({ where: { id: courseId } });
    if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
    if (institutionId)
      await db.institution.deleteMany({ where: { id: institutionId } });
    await db.emailEvent.deleteMany({
      where: {
        recipient: { in: [teacher.email!, student.email!, outsider.email!] },
      },
    });
    await db.user.deleteMany({
      where: { id: { in: [teacher.id, student.id, outsider.id] } },
    });
  }
});
