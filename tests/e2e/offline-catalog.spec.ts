import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

test("the offline catalog filters projects and opens a bundled preview", async ({ page }) => {
  await page.goto(pathToFileURL(resolve("ProjectHub Preview.html")).href + "#/explore");
  await page.getByRole("searchbox", { name: "Search projects" }).fill("TrailQuiz");
  await page.getByRole("button", { name: "Apply filters" }).click();
  const card = page.locator(".catalog-card:visible");
  await expect(card).toHaveCount(1);
  const [preview] = await Promise.all([
    page.waitForEvent("popup"),
    card.getByRole("link", { name: "Open TrailQuiz (new tab)" }).click(),
  ]);
  await expect(preview).toHaveURL(/\/preview-projects\/trailquiz\/index\.html$/);
  await expect(preview).toHaveTitle(/TrailQuiz/);
});
