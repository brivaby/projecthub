import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
const db = new PrismaClient();
const origin = process.env.APP_URL || "http://127.0.0.1:3000";
const browserOptions = {
  baseURL: origin,
  ignoreHTTPSErrors: Boolean(process.env.PROJECTHUB_TEST_TLS_CERT),
};
async function session(
  context: import("@playwright/test").BrowserContext,
  userId: string,
) {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      sessionToken: createHash("sha256").update(token).digest("hex"),
      userId,
      expires: new Date(Date.now() + 3600000),
    },
  });
  await context.addCookies([
    {
      name: "vic-session",
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
  await page.goto("/trending?q=sensor&technology=Arduino");
  await expect(page.getByRole("link", { name: "Remove Technology filter" })).toBeVisible();
  const card = page.locator(".project-card h3 a").first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/projects\/.*from=/);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/trending\?q=sensor&technology=Arduino/);
  await page.getByRole("link", { name: "Remove Technology filter" }).click();
  await expect(page).toHaveURL(/\/trending\?q=sensor$/);
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
  await page.getByLabel("Publication status").selectOption("PUBLISHED");
  await page.getByLabel("Attribution and AI-material disclosure").fill("No third-party or AI-generated material was used.");
  for (const name of ["rights", "contributorsConsent", "privacyConsent", "attribution", "integrity"]) {
    await page.locator(`input[name="${name}"]`).check();
  }
  const files = page.locator('input[name="files"]');
  await files.setInputFiles(["retry.txt", "complete.txt"].map((name) => ({
    name, mimeType: "text/plain", buffer: Buffer.from(name),
  })));
  let retryAttempts = 0;
  let completeAttempts = 0;
  await page.route("**/api/projects/*/files", async (route) => {
    const retry = route.request().postData()?.includes('filename="retry.txt"');
    const failed = retry && ++retryAttempts === 1;
    if (!retry) completeAttempts++;
    await route.fulfill({
      status: failed ? 503 : 201,
      json: failed ? { error: { message: "Temporary upload failure" } } : { scanStatus: "PENDING" },
    });
  });
  try {
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Your project was saved");
    await expect(page.getByRole("link", { name: "Open saved project editor" })).toHaveAttribute("href", /\/projects\/.+\/edit/);
    await page.getByRole("button", { name: "Retry failed uploads" }).click();
    await expect(page.getByRole("list", { name: "File upload status" })).toContainText("retry.txt · Uploaded, awaiting scan");
    expect(retryAttempts).toBe(2);
    expect(completeAttempts).toBe(1);

    await page.getByRole("link", { name: "View saved project" }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    const p = await db.project.findFirstOrThrow({ where: { title } });
    expect(p.ownerId).toBe("dev-joshua");
    await page.goto(`/trending?q=${encodeURIComponent(title)}`);
    await expect(page.locator(".project-card h3")).toContainText(title);
  } finally {
    await db.project.deleteMany({ where: { title, ownerId: "dev-joshua" } });
  }
});
test("concurrent collaboration approvals grant access and queue a decision once", async ({
  browser,
}) => {
  const suffix = randomUUID();
  const requester = await db.user.create({
    data: {
      email: `${suffix}@vicacademy.org`,
      name: "Workflow Test",
      emailVerified: new Date(),
      collaborationRulesAcceptedAt: new Date(),
    },
  });
  const context = await browser.newContext(browserOptions);
  await session(context, requester.id);
  const owner = await browser.newContext(browserOptions);
  let requestId: string | undefined;
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
    const id = (await r.json()).id as string;
    requestId = id;
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
    await session(owner, "dev-amara");
    const decide = () => owner.request.patch(`/api/requests/${id}`, {
      headers: { origin },
      data: { status: "ACCEPTED", response: "Welcome to the team!" },
    });
    const decisions = await Promise.all([decide(), decide()]);
    expect(decisions.map((result) => result.status()).sort()).toEqual([200, 409]);
    expect(await db.collaborator.count({ where: {
      projectId: "dev-greener-campus", userId: requester.id,
    } })).toBe(1);
    expect(await db.emailEvent.count({ where: {
      dedupeKey: { startsWith: `decision:${id}:ACCEPTED:` },
    } })).toBe(1);
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
  } finally {
    await owner.close();
    await context.close();
    if (requestId) {
      const id = requestId;
      await db.emailEvent.deleteMany({ where: { OR: [
        { dedupeKey: { startsWith: `request:${id}:` } },
        { dedupeKey: { startsWith: `decision:${id}:` } },
      ] } });
    }
    await db.emailEvent.deleteMany({ where: { recipient: requester.email! } });
    await db.user.delete({ where: { id: requester.id } });
  }
});
test("registration sends a one-time code and enables password sign-in", async ({ page, request }) => {
  test.skip(!process.env.MAILPIT_URL, "Requires Mailpit and the email worker");
  const email = `registration-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("hex");
  try {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("ProjectHub Browser Test");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    for (const name of ["terms", "community", "privacy"]) {
      await page.locator(`input[name="${name}"]`).check();
    }
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);
    let code: string | undefined;
    await expect.poll(async () => {
      const base = process.env.MAILPIT_URL;
      const search = await request.get(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
      const { messages = [] } = await search.json();
      if (!messages.length) return false;
      const message = await (await request.get(`${base}/api/v1/message/${messages[0].ID}`)).json();
      code = (message.Text || message.HTML || "").match(/verification code is (\d{6})/i)?.[1];
      return Boolean(code);
    }, { timeout: 20_000 }).toBe(true);

    const verify = () => request.post("/api/account/verify", {
      headers: { origin }, data: { email, code },
    });
    const results = await Promise.all([verify(), verify()]);
    expect(results.map((result) => result.status()).sort()).toEqual([200, 422]);
    expect(await db.emailChallenge.count({ where: { email, usedAt: { not: null } } })).toBe(1);
    await expect.poll(() => db.emailEvent.findFirst({
      where: { recipient: email },
      select: { status: true, attempts: true },
    })).toEqual({ status: "SENT", attempts: 1 });
    expect(await db.emailEvent.count({ where: { recipient: email } })).toBe(1);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).not.toBeNull();

    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
  } finally {
    await db.emailEvent.deleteMany({ where: { recipient: email } });
    await db.user.deleteMany({ where: { email } });
  }
});
test("mobile discovery stays within viewport and forms have labels", async ({
  page,
}) => {
  await page.goto("/trending");
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

test("navigation keeps account links scoped to the signed-in role", async ({ page, context }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/trending");
  await page.locator(".mobile-nav summary").focus();
  await page.keyboard.press("Enter");
  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(navigation.getByRole("link", { name: "Browse projects" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "My courses" })).toHaveCount(0);
  await session(context, "dev-joshua");
  for (const width of [390, 850, 900]) {
    await page.setViewportSize({ width, height: 800 });
    await page.reload();
    await page.locator(".mobile-nav summary").click();
    await expect(navigation.getByRole("link", { name: "My courses" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "My workspace" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Admin" })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", {
    name: "My courses",
  })).toBeVisible();
  await expect(page.getByRole("link", { name: "My workspace" })).toBeVisible();
});
