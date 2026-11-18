# Education and workspace review

## Implemented

- Teacher/admin course creation and own-course authorization, delegated approved teacher membership, editing and archive controls.
- Verified Vic Academy student membership requests, teacher invitations and approval/rejection/removal, class groups and approved-member assignment.
- Assignments with explicit deadlines, weighted rubric validation, publication-review requirements and maximum scores.
- Owned project submission, late-submission rejection, atomic review, private grades/feedback, review notifications and safe CSV grade export.
- Teacher-curated collections and public showcases that recheck public/published project visibility at render time; private grades never enter showcases.
- Workspace tasks and milestones with due dates, assignment to current eligible members, contributor-level mutation permissions, live collaboration eligibility, block checks, private activity and audit logs.
- Functional course and task interfaces with native labeled controls, explicit privacy explanations, confirmation for destructive actions and visible errors.

## Contracts and ownership

Uses Course.memberships/classes/assignments/collections, Assignment.submissions, Submission, CourseCollection.projects, WorkspaceTask and shared live eligibility helpers. Workspace page integration: render `WorkspaceTasks` from `@/components/workspace-tasks` with `projectId`. `/courses` is the authenticated navigation entry; teacher creation is visible only to TEACHER/ADMIN accounts. Public showcases are `/courses/showcases/:collectionId`.

Course grades are selected only after `courseAccess` verifies membership, and student queries filter by `userId`. Grade export is teacher/admin-only and marked private/no-store. Student membership is rechecked against the currently verified Vic Academy domain. External teachers may manage courses only with the assigned teacher role and ownership, but still cannot enter collaboration workspaces without separate Vic eligibility.

The lead project-write path must prevent bypass of required review, invalidate approvals after substantive student edits, and enforce COURSE visibility against approved course membership. Course submissions set PENDING_REVIEW/PRIVATE for review-required work. Teachers may publish an approved submission only with the creator’s stored rights confirmation.

## Verification

19 passing education unit/route tests: `tests/education.test.ts` covers course ownership and delegation, denied membership states, live domain verification, rubric totals, grades, deadlines, private-feedback filtering, CSV formula injection and workspace mutation permissions. `tests/education-routes.test.ts` additionally checks query-level grade privacy, public collection secrecy, outside-domain task denials and administrator viewer non-bypass. `tests/e2e/education.spec.ts` adds a real PostgreSQL teacher/student review, grades/export and public showcase journey; it has not run in this sandbox. Real database/browser tests remain necessary; no simulated backend is used by runtime handlers.

## Boundaries

Class groups organize approved course users; per-class project visibility is not separate from course-only visibility in this iteration. Course invitations target existing verified Vic accounts; unknown addresses get the same generic response and must register before invitation. Assignment creation/editing/review and course archive are implemented; attendance, bulk imports, external LMS integration, live chat and rich collaborative document editing are not implemented. CSV export is capped at 10,000 submissions and should use streamed export before larger academic datasets.
