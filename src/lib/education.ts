import { z } from "zod";
import { HttpError } from "./http-error";
import { verifiedVic } from "./eligibility";

export type EducationActor = {
  id: string;
  role: string;
  suspended: boolean;
  deletedAt: Date | null;
  emailVerified?: Date | null;
  email?: string | null;
};
export function canTeachCourse(
  user: EducationActor | null | undefined,
  course: { teacherId: string | null; archived: boolean },
  memberships: { userId: string; status: string; role: string }[] = [],
) {
  return (
    !!user &&
    !user.suspended &&
    !user.deletedAt &&
    !course.archived &&
    (user.role === "ADMIN" ||
      (user.role === "TEACHER" &&
        (course.teacherId === user.id ||
          memberships.some(
            (m) =>
              m.userId === user.id &&
              m.status === "APPROVED" &&
              m.role === "TEACHER",
          ))))
  );
}
export function canReadCourse(
  user: EducationActor | null | undefined,
  course: { teacherId: string | null; archived: boolean },
  memberships: { userId: string; status: string; role: string }[] = [],
) {
  return (
    canTeachCourse(user, course, memberships) ||
    (!!user &&
      verifiedVic(user) &&
      !user.suspended &&
      !user.deletedAt &&
      !course.archived &&
      memberships.some((m) => m.userId === user.id && m.status === "APPROVED"))
  );
}
export const courseInput = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(5000).default(""),
  institution: z.string().trim().min(2).max(160),
});
export const assignmentInput = z
  .object({
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(10).max(20000),
    deadline: z.string().datetime().nullable().optional(),
    maxScore: z.number().positive().max(10000).default(100),
    requiresReview: z.boolean().default(true),
    rubric: z
      .array(
        z.object({
          criterion: z.string().trim().min(2).max(300),
          points: z.number().min(0).max(10000),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((v, c) => {
    if (
      Math.abs(
        v.rubric.reduce((sum, item) => sum + item.points, 0) - v.maxScore,
      ) > 0.001
    )
      c.addIssue({
        code: "custom",
        path: ["rubric"],
        message: "Rubric points must add up to the maximum score",
      });
  });
export const submissionInput = z.object({
  assignmentId: z.string().min(1),
  projectId: z.string().min(1),
});
export const reviewInput = z.object({
  submissionId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  grade: z.number().min(0).optional(),
  feedback: z.string().trim().max(20000).default(""),
  publish: z.boolean().default(false),
});
export function validateGrade(grade: number | undefined, maxScore: number) {
  if (
    grade !== undefined &&
    (!Number.isFinite(grade) || grade < 0 || grade > maxScore)
  )
    throw new HttpError(
      422,
      "Grade must be between zero and the assignment maximum",
    );
}
export function validateSubmissionDeadline(
  deadline: Date | null | undefined,
  now = new Date(),
) {
  if (deadline && now.getTime() > deadline.getTime())
    throw new HttpError(422, "The assignment deadline has passed");
}
export function visibleFeedback<T extends { userId: string }>(
  rows: T[],
  actorId: string,
  instructor: boolean,
) {
  return instructor ? rows : rows.filter((r) => r.userId === actorId);
}
export const taskInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(10000).default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  assigneeId: z.string().min(1).nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
  milestone: z.boolean().default(false),
});
export function canEditWorkspaceTasks(
  permission: string | undefined,
  owner: boolean,
) {
  return (
    owner || ["CONTRIBUTOR", "EDITOR", "MANAGER"].includes(permission || "")
  );
}
export function safeCsv(value: unknown) {
  const text = String(value ?? "");
  const protectedText = /^(?:\s*[=+\-@]|[\t\r])/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}
