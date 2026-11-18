import { describe, it, expect } from "vitest";
import {
  defaultRankingWeights,
  rankingWeightsSchema,
  settingInput,
  notificationKinds,
} from "../src/lib/platform-settings";
describe("Administrator settings contract", () => {
  it("accepts the documented ranking defaults and preserves all explicit weights", () => {
    const parsed = settingInput.parse({
      key: "rankingWeights",
      value: defaultRankingWeights,
    });
    expect(parsed.value).toEqual(defaultRankingWeights);
  });
  it.each([
    "views",
    "likes",
    "bookmarks",
    "comments",
    "clones",
    "collaborations",
  ])("rejects negative or excessive %s influence", (key) => {
    expect(
      rankingWeightsSchema.safeParse({ ...defaultRankingWeights, [key]: -1 })
        .success,
    ).toBe(false);
    expect(
      rankingWeightsSchema.safeParse({ ...defaultRankingWeights, [key]: 101 })
        .success,
    ).toBe(false);
  });
  it("requires finite decay settings with a meaningful positive period", () => {
    expect(
      rankingWeightsSchema.safeParse({ ...defaultRankingWeights, decayDays: 0 })
        .success,
    ).toBe(false);
    expect(
      rankingWeightsSchema.safeParse({
        ...defaultRankingWeights,
        decayPower: Number.NaN,
      }).success,
    ).toBe(false);
    expect(
      rankingWeightsSchema.safeParse({
        ...defaultRankingWeights,
        decayPower: Infinity,
      }).success,
    ).toBe(false);
  });
  it("rejects arbitrary platform keys and string-valued feature flags", () => {
    expect(
      settingInput.safeParse({ key: "makeMeAdmin", value: { role: "ADMIN" } })
        .success,
    ).toBe(false);
    expect(
      settingInput.safeParse({
        key: "moderation",
        value: { reviewNewProjects: "false", allowPublicComments: true },
      }).success,
    ).toBe(false);
  });
  it("requires every recommendation control so partial UI saves cannot erase another control", () => {
    expect(
      settingInput.safeParse({
        key: "recommendations",
        value: { enabled: false },
      }).success,
    ).toBe(false);
    expect(
      settingInput.safeParse({
        key: "recommendations",
        value: { enabled: false, personalization: false, diversity: true },
      }).success,
    ).toBe(true);
  });
  it("bounds retention periods and rejects fractional day values", () => {
    for (const value of [
      { analyticsDays: 0, sentEmailDays: 30, usedChallengeDays: 7 },
      { analyticsDays: 90, sentEmailDays: 366, usedChallengeDays: 7 },
      { analyticsDays: 90, sentEmailDays: 30, usedChallengeDays: 91 },
      { analyticsDays: 90.5, sentEmailDays: 30, usedChallengeDays: 7 },
    ])
      expect(settingInput.safeParse({ key: "retention", value }).success).toBe(
        false,
      );
    expect(
      settingInput.safeParse({
        key: "retention",
        value: { analyticsDays: 90, sentEmailDays: 30, usedChallengeDays: 7 },
      }).success,
    ).toBe(true);
  });
  it("keeps the notification taxonomy explicit and duplicate-free", () => {
    expect(new Set(notificationKinds).size).toBe(notificationKinds.length);
    expect(notificationKinds).toContain("SECURITY");
    expect(notificationKinds).toContain("OWNERSHIP");
    expect(notificationKinds.every((kind) => /^[A-Z]+$/.test(kind))).toBe(true);
  });
});
