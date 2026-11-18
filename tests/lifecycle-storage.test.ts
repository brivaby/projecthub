import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { inspectZip, storageQuota } from "../src/lib/archive-safety";
import {
  releaseInput,
  transferInput,
  transferResolvable,
  canPublishRelease,
  buildSnapshot,
  restoredPublicationState,
} from "../src/lib/project-lifecycle";
function zip(
  name: string,
  data: Buffer,
  options: { declaredSize?: number; symlink?: boolean } = {},
) {
  const nameBytes = Buffer.from(name),
    packed = deflateRawSync(data),
    local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(options.declaredSize ?? data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  if (options.symlink) central.writeUInt32LE((0xa1ff << 16) >>> 0, 38);
  const body = Buffer.concat([local, nameBytes, packed]),
    directory = Buffer.concat([central, nameBytes]);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, directory, end]);
}
describe("ZIP validation and quotas", () => {
  it("inspects source files without extraction", () =>
    expect(
      inspectZip(zip("src/main.ts", Buffer.from("export const x=1;"))),
    ).toMatchObject({ entries: 1, expandedBytes: 17 }));
  it.each([
    "../secret.txt",
    "/tmp/secret.txt",
    "a/../../x.txt",
    "a\\x.txt",
    "nested.zip",
    "run.exe",
    "Bundle.app/",
  ])("rejects dangerous archive member %s", (name) =>
    expect(() => inspectZip(zip(name, Buffer.from("test")))).toThrow(),
  );
  it("rejects symlinks", () =>
    expect(() =>
      inspectZip(zip("link", Buffer.from("target"), { symlink: true })),
    ).toThrow(/Symbolic/));
  it("rejects compressed bombs before inflation", () =>
    expect(() =>
      inspectZip(zip("large.txt", Buffer.alloc(100000, 65))),
    ).toThrow(/expansion/));
  it("verifies actual size rather than trusting metadata", () =>
    expect(() =>
      inspectZip(
        zip("test.txt", Buffer.from("more than declared"), { declaredSize: 1 }),
      ),
    ).toThrow());
  it("rejects malformed archives", () =>
    expect(() => inspectZip(Buffer.from("PKfake"))).toThrow());
  it("limits entry counts", () =>
    expect(() =>
      inspectZip(zip("x.txt", Buffer.from("x")), { maxEntries: 0 }),
    ).toThrow());
  it("enforces configurable total project storage", () => {
    expect(storageQuota(50, 50, 100)).toBe(100);
    expect(() => storageQuota(51, 50, 100)).toThrow();
    expect(() => storageQuota(0, 1, NaN)).toThrow();
  });
});
describe("Release and ownership contracts", () => {
  it("restoring an approved project always invalidates public publication state", () => {
    expect(restoredPublicationState(false).status).toBe("DRAFT");
    expect(restoredPublicationState(true).status).toBe("PENDING_REVIEW");
    expect(
      canPublishRelease({
        deletedAt: null,
        archived: false,
        status: restoredPublicationState(true).status,
        rightsConfirmedAt: new Date(),
      }),
    ).toBe(false);
  });
  it("validates immutable release labels and meaningful notes", () => {
    expect(
      releaseInput.safeParse({
        label: "1.0.0",
        title: "First release",
        notes: "Initial validated project release.",
      }).success,
    ).toBe(true);
    expect(
      releaseInput.safeParse({ label: "../bad", title: "x", notes: "short" })
        .success,
    ).toBe(false);
  });
  it("requires explicit recipient and proposal type", () => {
    expect(transferInput.parse({ email: "STUDENT@vicacademy.org" }).email).toBe(
      "student@vicacademy.org",
    );
    expect(
      transferInput.safeParse({ email: "wrong", kind: "FORCE" }).success,
    ).toBe(false);
  });
  it("does not resolve expired or already resolved proposals", () => {
    expect(transferResolvable("PENDING", new Date(2000), new Date(1000))).toBe(
      true,
    );
    expect(transferResolvable("PENDING", new Date(1000), new Date(1000))).toBe(
      false,
    );
    expect(transferResolvable("ACCEPTED", new Date(2000), new Date(1000))).toBe(
      false,
    );
  });
  it("does not publish unreviewed or removed content", () => {
    const p = {
      deletedAt: null,
      archived: false,
      status: "PUBLISHED",
      rightsConfirmedAt: new Date(),
    };
    expect(canPublishRelease(p)).toBe(true);
    expect(canPublishRelease({ ...p, status: "PENDING_REVIEW" })).toBe(false);
    expect(canPublishRelease({ ...p, rightsConfirmedAt: null })).toBe(false);
  });
  it("snapshots content without persisting owner identifiers or visibility", () => {
    const result = buildSnapshot(
      {
        title: "Project",
        summary: "Summary",
        description: "Description",
        technologies: ["Python"],
        languages: ["Python"],
        license: "MIT",
        customLicense: "",
        tags: [{ tag: { name: "Science" } }],
        links: [],
        contributors: [{ name: "Student", contribution: "Research" }],
      },
      ["f1", "f1"],
    );
    expect(result.fileIds).toEqual(["f1"]);
    expect(result).not.toHaveProperty("ownerId");
    expect(result).not.toHaveProperty("visibility");
  });
});
