import { z } from "zod";
export const safeUrl = z
  .string()
  .url()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !["localhost", "127.0.0.1", "::1"].includes(u.hostname)
      );
    } catch {
      return false;
    }
  }, "Use a public HTTPS URL");
export const licenses = [
  "MIT",
  "Apache 2.0",
  "GPL-3.0",
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "Custom",
  "All rights reserved",
] as const;
export const projectInput = z.object({
  title: z.string().trim().min(5).max(140),
  summary: z.string().trim().min(20).max(240),
  description: z.string().trim().min(80).max(40000),
  category: z.string().min(2).max(80),
  institution: z.string().min(2).max(160),
  course: z.string().max(160).default(""),
  courseId: z.string().max(100).optional(),
  academicLevel: z.string().min(2).max(80),
  projectType: z.string().min(2).max(80),
  technologies: z.array(z.string().max(40)).max(15),
  languages: z.array(z.string().max(40)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  license: z.enum(licenses),
  visibility: z.enum([
    "PUBLIC",
    "PRIVATE",
    "UNLISTED",
    "INSTITUTION",
    "COURSE",
    "SCHEDULED",
  ]),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]).default("DRAFT"),
  scheduledAt: z.string().datetime().optional(),
  commentPolicy: z
    .enum(["OPEN", "VIC_ONLY", "MODERATED", "DISABLED"])
    .default("MODERATED"),
  clonePolicy: z.enum(["MANUAL", "AUTO", "DISABLED"]).default("MANUAL"),
  recommendable: z.boolean().default(true),
  customLicense: z.string().max(15000).default(""),
  integrityStatement: z.string().trim().min(10).max(2000),
  attestations: z.object({
    rights: z.literal(true),
    contributors: z.literal(true),
    privacy: z.literal(true),
    attribution: z.literal(true),
    integrity: z.literal(true),
  }),
  collaboration: z.enum(["OPEN", "LIMITED", "CLOSED"]),
  cloningAllowed: z.boolean(),
  commentsApproval: z.boolean(),
  cover: z.enum(["forest", "ocean", "clay", "violet", "gold", "slate"]),
  links: z
    .array(
      z.object({
        kind: z.enum([
          "Repository",
          "Demo",
          "Documentation",
          "Video",
          "External",
        ]),
        url: safeUrl,
      }),
    )
    .max(8),
  contributors: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        contribution: z.string().max(200),
      }),
    )
    .max(30),
  originalId: z.string().optional(),
});
export const requestInput = z
  .object({
    type: z.enum(["COMMENT", "COLLABORATION", "CLONE"]),
    message: z.string().trim().min(10).max(4000),
    permission: z
      .enum(["VIEWER", "COMMENTER", "CONTRIBUTOR", "EDITOR", "MANAGER"])
      .default("VIEWER"),
    details: z.object({
      context: z.string().max(1000).optional(),
      skills: z.string().max(1000).optional(),
      contribution: z.string().max(2000).optional(),
      responsibilities: z.string().max(1000).optional(),
      availability: z.string().max(500).optional(),
      communication: z.string().max(500).optional(),
      estimatedDuration: z.string().trim().min(1).max(500).optional(),
      attributionPlan: z.string().trim().min(1).max(1000).optional(),
      reason: z.string().max(1000).optional(),
      intendedUse: z.string().max(1000).optional(),
      modifications: z.string().max(1000).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
      licenseAgreed: z.boolean().optional(),
    }),
  })
  .superRefine((v, c) => {
    const required =
      v.type === "COLLABORATION"
        ? [
            "skills",
            "contribution",
            "responsibilities",
            "availability",
            "communication",
            "estimatedDuration",
          ]
        : v.type === "CLONE"
          ? [
              "reason",
              "intendedUse",
              "modifications",
              "visibility",
              "attributionPlan",
            ]
          : [];
    for (const k of required)
      if (!v.details[k as keyof typeof v.details])
        c.addIssue({
          code: "custom",
          path: ["details", k],
          message: "Required",
        });
    if (v.type === "CLONE" && !v.details.licenseAgreed)
      c.addIssue({
        code: "custom",
        path: ["details", "licenseAgreed"],
        message: "Agree to license and attribution",
      });
  });
const allowed: Record<string, string[]> = {
  zip: ["application/zip", "application/x-zip-compressed"],
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  txt: ["text/plain"],
  md: ["text/plain", "text/markdown"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};
export function validateFile(name: string, mime: string, size: number) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (
    name.length > 180 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9 _().-]*$/.test(name) ||
    name.includes("..")
  )
    throw new Error("Unsafe filename");
  if (!allowed[ext]?.includes(mime)) throw new Error("Unsupported file type");
  if (size <= 0 || size > 25 * 1024 * 1024)
    throw new Error("Files must be between 1 byte and 25 MB");
  return ext;
}
export function validateSignature(ext: string, b: Buffer) {
  if (
    ["zip", "pptx", "xlsx", "docx"].includes(ext) &&
    b.subarray(0, 4).toString("hex") !== "504b0304"
  )
    throw new Error("Invalid archive");
  if (ext === "pdf" && b.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Invalid PDF");
  if (ext === "png" && b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("Invalid PNG");
  if (
    ["jpg", "jpeg"].includes(ext) &&
    b.subarray(0, 3).toString("hex") !== "ffd8ff"
  )
    throw new Error("Invalid JPEG");
  if (
    ext === "webp" &&
    (b.subarray(0, 4).toString() !== "RIFF" ||
      b.subarray(8, 12).toString() !== "WEBP")
  )
    throw new Error("Invalid WebP");
  if (["txt", "md", "csv"].includes(ext) && b.includes(0))
    throw new Error("Binary content in text file");
}
