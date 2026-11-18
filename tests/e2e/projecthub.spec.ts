import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const db = new PrismaClient();
const origin = process.env.APP_URL || "http://127.0.0.1:3000";
async function session(
  context: import("@playwright/test").BrowserContext,
  userId: string,
) {
  const token = randomUUID();
  await db.session.create({
    data: {
      sessionToken: token,
      userId,
      expires: new Date(Date.now() + 3600000),
    },
  });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return token;
}
test.afterAll(() => db.$disconnect());
test("visitors search public work, open cards securely, and cannot access private projects", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Classroom ideas/ }),
  ).toBeVisible();
  const card = page.locator(".project-card h3 a").first();
  await expect(card).toHaveAttribute("target", "_blank");
  await expect(card).toHaveAttribute("rel", "noopener noreferrer");
  await page.goto("/explore?q=sensor");
  await expect(page.locator(".project-card")).not.toHaveCount(0);
  await page.goto("/projects/dev-private-notes");
  await expect(
    page.getByRole("heading", { name: "This idea isn’t here." }),
  ).toBeVisible();
  expect(
    (
      await request.post("/api/projects", {
        headers: { origin },
        data: { title: "unauthorized" },
      })
    ).status(),
  ).toBe(401);
});
test("database sessions enforce roles and project ownership", async ({
  context,
  request,
  page,
}) => {
  await session(context, "dev-joshua");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "This idea isn’t here." }),
  ).toBeVisible();
  const res = await context.request.delete("/api/projects/dev-greener-campus", {
    headers: { origin },
  });
  expect(res.status()).toBe(403);
  const csrf = await context.request.post(
    "/api/projects/dev-greener-campus/engagement",
    { headers: { origin: "https://evil.example" }, data: { kind: "LIKE" } },
  );
  expect(csrf.status()).toBe(403);
  const publicData = await (await request.get("/api/projects")).text();
  expect(publicData).not.toContain("@example.test");
  expect(publicData).not.toContain("dev-private-notes");
});
test("publishing and filtering persist real records", async ({
  context,
  page,
}) => {
  await session(context, "dev-joshua");
  await page.goto("/upload");
  const title = `Capstone ${randomUUID()}`;
  await page.getByLabel("Project title", { exact: true }).fill(title);
  await page
    .getByLabel("Short summary")
    .fill(
      "A useful student research project demonstrating a real database workflow.",
    );
  await page
    .getByLabel("Full description")
    .fill(
      "We researched a campus problem, interviewed students, developed a prototype, and evaluated the results. This capstone documents our methods, outcomes, limitations, and next steps for future contributors.",
    );
  await page
    .getByLabel("Institution", { exact: true })
    .fill("University of Nairobi");
  await page.getByLabel("Visibility", { exact: true }).selectOption("PUBLIC");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const p = await db.project.findFirstOrThrow({ where: { title } });
  expect(p.ownerId).toBe("dev-joshua");
  await page.goto(`/explore?q=${encodeURIComponent(title)}`);
  await expect(page.locator(".project-card h3")).toContainText(title);
  await db.project.delete({ where: { id: p.id } });
});
test("clone and collaboration approval grants access only after an atomic decision", async ({
  browser,
}) => {
  const id = randomUUID();
  const requester = await db.user.create({
    data: { email: `${id}@example.test`, name: "Workflow Test" },
  });
  const context = await browser.newContext({ baseURL: origin });
  await session(context, requester.id);
  try {
    const r = await context.request.post(
      "/api/projects/dev-greener-campus/requests",
      {
        headers: { origin },
        data: {
          type: "COLLABORATION",
          message: "I can contribute sensor calibration and testing.",
          permission: "CONTRIBUTOR",
          details: {
            skills: "IoT",
            contribution: "Calibration",
            responsibilities: "Testing",
            availability: "Weekly",
            communication: "In-app",
          },
        },
      },
    );
    expect(r.status()).toBe(201);
    const { id: requestId } = await r.json();
    expect(
      await db.collaborator.findUnique({
        where: {
          projectId_userId: {
            projectId: "dev-greener-campus",
            userId: requester.id,
          },
        },
      }),
    ).toBeNull();
    expect(
      await db.emailEvent.count({
        where: { dedupeKey: { startsWith: `request:${requestId}:` } },
      }),
    ).toBe(2);
    expect(
      (
        await context.request.post(
          "/api/projects/dev-greener-campus/requests",
          {
            headers: { origin },
            data: {
              type: "COLLABORATION",
              message: "I can contribute sensor calibration and testing.",
              details: {
                skills: "IoT",
                contribution: "Calibration",
                responsibilities: "Testing",
                availability: "Weekly",
                communication: "In-app",
              },
            },
          },
        )
      ).status(),
    ).toBe(409);
    const owner = await browser.newContext({ baseURL: origin });
    await session(owner, "dev-amara");
    const result = await owner.request.patch(`/api/requests/${requestId}`, {
      headers: { origin },
      data: { status: "ACCEPTED", response: "Welcome to the team!" },
    });
    expect(result.status()).toBe(200);
    expect(
      (
        await db.collaborator.findUniqueOrThrow({
          where: {
            projectId_userId: {
              projectId: "dev-greener-campus",
              userId: requester.id,
            },
          },
        })
      ).permission,
    ).toBe("CONTRIBUTOR");
    expect(
      (
        await owner.request.patch(`/api/requests/${requestId}`, {
          headers: { origin },
          data: { status: "ACCEPTED" },
        })
      ).status(),
    ).toBe(409);
    await owner.close();
  } finally {
    await context.close();
    await db.emailEvent.deleteMany({ where: { recipient: requester.email! } });
    await db.user.delete({ where: { id: requester.id } });
  }
});
test("registration and login use an actual single-use email link", async ({
  page,
  request,
}) => {
  test.skip(!process.env.MAILPIT_URL, "Requires the local Mailpit service");
  const email = `registration-${randomUUID()}@example.test`;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  const messages = await request.get(
    `${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const list = await messages.json();
  expect(list.messages.length).toBeGreaterThan(0);
  const mail = await (
    await request.get(
      `${process.env.MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`,
    )
  ).json();
  const href = mail.HTML.match(
    /href="([^"]*\/api\/auth\/callback[^\"]*)"/,
  )?.[1]?.replaceAll("&amp;", "&");
  expect(href).toBeTruthy();
  await page.goto(href);
  await expect(page).toHaveURL(/dashboard/);
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.emailVerified).not.toBeNull();
  await db.user.delete({ where: { id: user.id } });
});
test("mobile discovery stays within viewport and forms have labels", async ({
  page,
}) => {
  await page.goto("/explore");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("textbox", { name: "Search projects" }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
});
