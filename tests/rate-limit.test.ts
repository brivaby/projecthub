import { it, expect, vi } from "vitest";
const upsert = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/db", () => ({ db: { rateLimit: { upsert } } }));
import { limit } from "../src/lib/rate-limit";
it("allows a request below the limit and hashes account identity", async () => {
  upsert.mockResolvedValue({ count: 1 });
  await expect(limit("private-email@example.test", 3)).resolves.toBeUndefined();
  expect(upsert.mock.calls.at(-1)?.[0].where.key).not.toContain(
    "private-email",
  );
});
it("rejects requests above a distributed database counter", async () => {
  upsert.mockResolvedValue({ count: 4 });
  await expect(limit("user", 3)).rejects.toMatchObject({ status: 429 });
});
