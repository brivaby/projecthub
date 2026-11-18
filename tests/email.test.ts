import { describe, it, expect, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({
  claimed: [] as { id: string }[],
  events: new Map<string, Record<string, unknown>>(),
  updates: [] as Record<string, unknown>[],
  send: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(async () => state.claimed),
    emailEvent: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.events.get(where.id),
      ),
      update: vi.fn(async (data: Record<string, unknown>) => {
        state.updates.push(data);
      }),
    },
  },
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: state.send }) },
}));
import { emailTemplate, escapeHtml, flushEmails } from "../src/lib/email";
beforeEach(() => {
  state.claimed = [];
  state.events.clear();
  state.updates = [];
  state.send.mockReset();
});
describe("Official email safety and outbox", () => {
  it("escapes user-generated content", () => {
    const result = emailTemplate(
      "Request <script>",
      "Hi <img src=x onerror=alert(1)>",
      "https://projecthub.example/requests",
    );
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
    expect(escapeHtml('"&<>')).toBe("&quot;&amp;&lt;&gt;");
  });
  it("does not send email without claimed work", async () => {
    expect(await flushEmails()).toBe(0);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("marks successfully delivered mail sent", async () => {
    state.claimed = [{ id: "e1" }];
    state.events.set("e1", {
      id: "e1",
      dedupeKey: "request:test:owner",
      recipient: "owner@example.test",
      subject: "Request",
      html: "<p>Hello</p>",
      attempts: 0,
    });
    state.send.mockResolvedValue({});
    expect(await flushEmails()).toBe(1);
    expect(state.send).toHaveBeenCalledOnce();
    expect(state.updates[0]).toMatchObject({
      data: { status: "SENT", attempts: { increment: 1 } },
    });
  });
  it("retains failed delivery for retry without failing the request", async () => {
    state.claimed = [{ id: "e1" }];
    state.events.set("e1", {
      id: "e1",
      dedupeKey: "request:test:owner",
      recipient: "owner@example.test",
      subject: "Request",
      html: "Hello",
      attempts: 0,
    });
    state.send.mockRejectedValue(new Error("offline"));
    await flushEmails();
    expect(state.updates[0]).toMatchObject({
      data: { status: "RETRY", error: "SMTP delivery failed" },
    });
  });
  it("stops retrying after the configured attempt limit", async () => {
    state.claimed = [{ id: "e1" }];
    state.events.set("e1", {
      id: "e1",
      dedupeKey: "request:test:owner",
      recipient: "owner@example.test",
      subject: "Request",
      html: "Hello",
      attempts: 4,
    });
    state.send.mockRejectedValue(new Error("offline"));
    await flushEmails();
    expect(state.updates[0]).toMatchObject({ data: { status: "FAILED" } });
  });
});
