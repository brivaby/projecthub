import { z } from "zod";
export const releaseInput = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  title: z.string().trim().min(3).max(140),
  notes: z.string().trim().min(10).max(10000),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  fileIds: z.array(z.string().min(1)).max(100).default([]),
});
export const releaseAction = z.object({
  versionId: z.string().min(1),
  action: z.enum(["PUBLISH", "ARCHIVE", "RESTORE"]),
});
export const transferInput = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.trim().toLowerCase()),
  kind: z.enum(["TRANSFER", "ADD_OWNER"]).default("TRANSFER"),
});
export const transferDecision = z.object({
  transferId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "CANCEL"]),
});
export const contentSnapshot = z.object({
  title: z.string().min(1).max(140),
  summary: z.string().max(240),
  description: z.string().max(40000),
  technologies: z.array(z.string().max(40)).max(15),
  languages: z.array(z.string().max(40)).max(20),
  license: z.string().max(100),
  customLicense: z.string().max(20000).default(""),
  tags: z.array(z.string().max(30)).max(10),
  links: z
    .array(
      z.object({ kind: z.string().max(40), url: z.string().url().max(2048) }),
    )
    .max(10),
  contributors: z
    .array(
      z.object({
        name: z.string().max(100),
        contribution: z.string().max(200),
      }),
    )
    .max(30),
  fileIds: z.array(z.string()).max(100),
});
export type ContentSnapshot = z.infer<typeof contentSnapshot>;
export function buildSnapshot(
  project: {
    title: string;
    summary: string;
    description: string;
    technologies: string[];
    languages: string[];
    license: string;
    customLicense: string;
    tags: { tag: { name: string } }[];
    links: { kind: string; url: string }[];
    contributors: { name: string; contribution: string }[];
  },
  fileIds: string[],
): ContentSnapshot {
  return contentSnapshot.parse({
    title: project.title,
    summary: project.summary,
    description: project.description,
    technologies: project.technologies,
    languages: project.languages,
    license: project.license,
    customLicense: project.customLicense,
    tags: project.tags.map((t) => t.tag.name),
    links: project.links.map(({ kind, url }) => ({ kind, url })),
    contributors: project.contributors.map(({ name, contribution }) => ({
      name,
      contribution,
    })),
    fileIds: [...new Set(fileIds)],
  });
}
export function releaseVisible(status: string, manager: boolean) {
  return manager || status === "PUBLISHED";
}
export function transferResolvable(
  status: string,
  expiresAt: Date,
  now = new Date(),
) {
  return status === "PENDING" && expiresAt.getTime() > now.getTime();
}
export function canPublishRelease(project: {
  deletedAt: Date | null;
  archived: boolean;
  status: string;
  rightsConfirmedAt: Date | null;
}) {
  return (
    !project.deletedAt &&
    !project.archived &&
    !!project.rightsConfirmedAt &&
    !["PENDING_REVIEW", "SUSPENDED", "REMOVED", "DELETED"].includes(
      project.status,
    )
  );
}

/** A restore is a new content change, never a substitute for publication/review consent. */
export function restoredPublicationState(requiresReview: boolean) {
  return { status: requiresReview ? "PENDING_REVIEW" : "DRAFT" } as const;
}
