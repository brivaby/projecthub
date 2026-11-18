import { describe, it, expect } from "vitest";
import {
  canTeachCourse,
  canReadCourse,
  assignmentInput,
  courseInput,
  validateGrade,
  validateSubmissionDeadline,
  visibleFeedback,
  canEditWorkspaceTasks,
  taskInput,
  safeCsv,
} from "../src/lib/education";
const student = {
  id: "student",
  role: "USER",
  suspended: false,
  deletedAt: null,
  email: "student@vicacademy.org",
  emailVerified: new Date(),
};
const teacher = { ...student, id: "teacher", role: "TEACHER" };
const course = { teacherId: "teacher", archived: false };
describe("Course authorization", () => {
  it("permits only the owning teacher or delegated approved teacher", () => {
    expect(canTeachCourse(teacher, course)).toBe(true);
    expect(canTeachCourse({ ...teacher, id: "other" }, course)).toBe(false);
    expect(
      canTeachCourse({ ...teacher, id: "delegate" }, course, [
        { userId: "delegate", status: "APPROVED", role: "TEACHER" },
      ]),
    ).toBe(true);
  });
  it("does not grant course teaching merely from a membership role", () =>
    expect(
      canTeachCourse(student, course, [
        { userId: student.id, status: "APPROVED", role: "TEACHER" },
      ]),
    ).toBe(false));
  it("denies pending, rejected, suspended, anonymous and archived access", () => {
    expect(
      canReadCourse(student, course, [
        { userId: student.id, status: "PENDING", role: "STUDENT" },
      ]),
    ).toBe(false);
    expect(
      canReadCourse(student, course, [
        { userId: student.id, status: "REJECTED", role: "STUDENT" },
      ]),
    ).toBe(false);
    expect(canReadCourse(null, course)).toBe(false);
    expect(canTeachCourse({ ...teacher, suspended: true }, course)).toBe(false);
    expect(canTeachCourse(teacher, { ...course, archived: true })).toBe(false);
  });
  it("permits approved Vic students and rechecks the verified current domain", () => {
    const members = [
      { userId: student.id, status: "APPROVED", role: "STUDENT" },
    ];
    expect(canReadCourse(student, course, members)).toBe(true);
    expect(
      canReadCourse(
        { ...student, email: "student@example.test" },
        course,
        members,
      ),
    ).toBe(false);
    expect(
      canReadCourse({ ...student, emailVerified: null }, course, members),
    ).toBe(false);
  });
  it("allows administrators without giving unrelated teachers access", () => {
    expect(canTeachCourse({ ...student, role: "ADMIN" }, course)).toBe(true);
    expect(canReadCourse({ ...teacher, id: "outsider" }, course)).toBe(false);
  });
});
describe("Assessment validation and privacy", () => {
  it("requires a rubric with matching total points", () => {
    const base = {
      title: "Capstone",
      description: "Build and document an original project.",
      maxScore: 100,
      rubric: [
        { criterion: "Research", points: 30 },
        { criterion: "Execution", points: 70 },
      ],
    };
    expect(assignmentInput.safeParse(base).success).toBe(true);
    expect(
      assignmentInput.safeParse({
        ...base,
        rubric: [{ criterion: "Research", points: 20 }],
      }).success,
    ).toBe(false);
  });
  it("rejects invalid deadlines, excessive text and blank courses", () => {
    expect(
      assignmentInput.safeParse({
        title: "Task",
        description: "An interesting research task",
        deadline: "yesterday",
        rubric: [{ criterion: "Report", points: 100 }],
      }).success,
    ).toBe(false);
    expect(
      courseInput.safeParse({ name: "  ", institution: "Vic Academy" }).success,
    ).toBe(false);
  });
  it("rejects grades beyond the assessment maximum", () => {
    expect(() => validateGrade(101, 100)).toThrow();
    expect(() => validateGrade(-1, 100)).toThrow();
    expect(() => validateGrade(Number.NaN, 100)).toThrow();
    expect(() => validateGrade(0, 100)).not.toThrow();
    expect(() => validateGrade(undefined, 100)).not.toThrow();
  });
  it("enforces deadlines with an explicit clock", () => {
    const deadline = new Date("2026-11-17T10:00:00Z");
    expect(() =>
      validateSubmissionDeadline(deadline, new Date("2026-11-17T10:00:01Z")),
    ).toThrow();
    expect(() =>
      validateSubmissionDeadline(deadline, new Date("2026-11-17T10:00:00Z")),
    ).not.toThrow();
  });
  it("never gives a student someone else’s private feedback", () => {
    const rows = [
      { userId: "a", feedback: "Private A" },
      { userId: "b", feedback: "Private B" },
    ];
    expect(visibleFeedback(rows, "a", false)).toEqual([rows[0]]);
    expect(visibleFeedback(rows, "teacher", true)).toEqual(rows);
  });
  it("protects grade exports against spreadsheet formula injection", () => {
    expect(safeCsv('=HYPERLINK("https://bad")')).toBe(
      '"\'=HYPERLINK(""https://bad"")"',
    );
    expect(safeCsv(" @SUM(A1)")).toContain("'");
    expect(safeCsv("ordinary, text")).toBe('"ordinary, text"');
    expect(safeCsv(null)).toBe('""');
  });
});
describe("Workspace task boundaries", () => {
  it("requires contributor-level permission or ownership for changes", () => {
    expect(canEditWorkspaceTasks("VIEWER", false)).toBe(false);
    expect(canEditWorkspaceTasks("COMMENTER", false)).toBe(false);
    for (const role of ["CONTRIBUTOR", "EDITOR", "MANAGER"])
      expect(canEditWorkspaceTasks(role, false)).toBe(true);
    expect(canEditWorkspaceTasks(undefined, true)).toBe(true);
  });
  it("validates task status and deadlines rather than trusting the browser", () => {
    expect(
      taskInput.safeParse({ title: "Test the sensors", dueAt: "tomorrow" })
        .success,
    ).toBe(false);
    expect(
      taskInput.safeParse({ title: "Test the sensors", status: "ADMIN" })
        .success,
    ).toBe(false);
    expect(
      taskInput.safeParse({ title: "Test the sensors", milestone: true })
        .success,
    ).toBe(true);
  });
});
