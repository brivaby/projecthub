# Vic Academy ProjectHub: architecture and integration contract

This revised specification supersedes the original generic ProjectHub brief. Work continues in this existing checkout; original student files remain untouched.

## 1. System architecture

Next.js App Router and TypeScript serve public pages and protected API routes. PostgreSQL/Prisma persist identity, explicit consents, project ownership, immutable release snapshots, course memberships, requests, moderation and analytics. Password authentication uses a trusted memory-hard password hash, opaque revocable database sessions and six-digit single-use hashed email challenges. SMTP/outbox, private S3-compatible storage and ClamAV remain environment-configured adapters. All authorization is server-side and live eligibility is checked on each collaboration operation.

## 2. Main user flows

- Register with full name, password confirmation and required policy consents; verify a six-digit email code; log in using a revocable session.
- Discover public work, optionally view institution/course-restricted work after authorization, open internal project pages in a secure new tab.
- An eligible verified Vic Academy student creates a draft, attests publication rights/integrity, uploads quarantined assets and publishes or submits for course review.
- An eligible student accepts collaboration rules, submits a formal request, and enters a workspace only after eligible owner approval. External users retain ordinary public commenting/bookmarking/clone features.
- Owners publish version snapshots, add approved co-owners and perform a two-party ownership transfer. Account deletion must preserve team projects.
- Teachers manage courses, class membership, assignments/rubrics/deadlines, submission reviews and private feedback. Grades remain private.
- Moderators review reports and integrity/copyright disputes; all sensitive actions enter an audit trail.

## 3. Database contracts (additive changes)

Keep existing model names to preserve integrations. Add:

- `User.passwordHash String?`, `studentId String?`, `termsAcceptedAt DateTime?`, `communityAcceptedAt DateTime?`, `privacyAcceptedAt DateTime?`, `collaborationRulesAcceptedAt DateTime?`; Role adds `TEACHER`.
- `EmailChallenge`: id, userId, email, purpose String (`VERIFY`, `RESET`, `EMAIL_CHANGE`), secretHash, expiresAt, attempts default 0, usedAt?, createdAt. Challenge issuance invalidates previous active challenges for the same user/purpose.
- `Consent`: id, userId, policy, version, acceptedAt.
- Profile adds `showInstitution`, `showDomainBadge`, `showCollaborations`, `showAvailability`, `showInRankings`, `personalizedRecommendations`, all Boolean; conservative defaults for identifying details.
- Visibility adds `INSTITUTION`, `COURSE`, `SCHEDULED`; Project adds `status String @default("DRAFT")`, `scheduledAt DateTime?`, `languages String[] @default([])`, `commentPolicy String @default("MODERATED")`, `clonePolicy String @default("MANUAL")`, `rightsConfirmedAt DateTime?`, `integrityStatement String @default("")`, `recommendable Boolean @default(true)`.
- `ProjectOwner`: projectId/userId composite PK, addedAt; relation name `Project.owners`. Retain Project.ownerId as primary owner for compatibility.
- `OwnershipTransfer`: id/projectId/fromUserId/toUserId/status/expiresAt/createdAt/resolvedAt?; requires recipient acceptance.
- `ProjectVersion`: id/projectId/label/title/notes/snapshot Json/status String/authorId/createdAt/publishedAt?; ProjectFile.versionId optional and relation.
- Course adds teacherId?, description default empty, archived default false; `CourseMembership` courseId/userId composite PK, status PENDING/APPROVED, role STUDENT/TEACHER, createdAt.
- `ClassGroup`: id/courseId/name; `ClassMember`: classId/userId composite PK.
- `Assignment`: id/courseId/title/description/deadline?/rubric Json/maxScore Float/requiresReview Boolean/createdAt.
- `Submission`: id/assignmentId/projectId/userId/status/grade Float?/feedback String?/createdAt/updatedAt; unique assignmentId/projectId. No public grades.
- `CourseCollection`: id/courseId/title/public Boolean; `CollectionProject`: collectionId/projectId composite PK.
- `WorkspaceTask`: id/projectId/title/description/status/assigneeId?/dueAt?/milestone Boolean/createdAt/updatedAt.
- `UserBlock`: blockerId/blockedId composite PK, createdAt. `FollowedCategory`: userId/categoryId PK. `SavedSearch`: id/userId/name/query Json/createdAt.
- RequestStatus adds EXPIRED; Request adds expiresAt?, privateNote? (never returned to requester).
- Report adds category String default GENERAL for COPYRIGHT, TAKEDOWN, INTEGRITY, OWNERSHIP and USER/PROJECT/COMMENT targets.
- `PlatformSetting`: key PK/value Json/updatedAt.

All additions require a new forward migration; preserve the original migration. Database owner resolves relation inverses and indexes and broadcasts any necessary contract adjustment before dependents change code.

## 4. Permission matrix

| Operation | Public visitor | External verified account | Verified Vic student | Teacher | Admin |
|---|---|---|---|---|---|
| Public showcase | yes | yes | yes | yes | yes |
| Bookmark/allowed comments/clone request | no | yes | yes | yes | yes |
| Create academic projects | no | no | yes | eligible Vic account | eligible Vic account |
| Collaboration/workspace/shared collaboration files | no | no | eligible + rules + approved | eligible + rules + approved | eligible + rules + approved |
| Manage course/grades | no | no | own approved submissions only | own courses | administrative scope |
| Project edits/versions/ownership | no | no | owner or permitted member | own/review scope | moderation scope |
| Platform moderation | no | no | no | class scope | yes |

Eligibility always requires an active account, verified current email, exact normalized domain `vicacademy.org`, and collaboration consent. Administrative role never silently bypasses this collaboration restriction.

## 5. Folder structure

Retain `src/app`, `src/components`, `src/lib`, `prisma`, `tests`, `scripts`, `docs`. Add auth routes under `/api/account`, course routes under `/api/courses`, release routes under `/api/projects/:id/versions`, ownership routes under `/api/projects/:id/ownership`, and workspace tasks under `/api/projects/:id/tasks`.

## 6. Verification flow

Generate exactly six numeric digits using cryptographic randomness; store only a keyed hash using AUTH_SECRET. Ten-minute configurable expiry; bounded attempts; resend cooldown plus rate limit; invalidate old challenges transactionally. Generic issuance replies avoid account enumeration. Verify under a row lock, consume once, record audit and consent, then permit session creation. Password reset and email-change confirmation use separate challenge purposes and revoke affected sessions.

## 7. Collaboration eligibility flow

Central pure `collaborationEligible(user)` and an asynchronous assertion reload the current user. Check on submission, approval (requester and acting owner), invitation/member updates, private workspace entry and shared-file access. Exact domain normalization rejects suffixes, lookalikes, multiple @ signs and unverified changed emails. User-facing denial: “Collaboration is currently limited to verified Vic Academy email accounts.”

## 8. Roadmap and coordinated ownership

Four concurrent workstreams, grouping the requested specializations within available agent capacity:

1. Identity/security: authentication, verification, authorization, collaboration eligibility, sessions, associated tests/docs.
2. Data/project lifecycle/DevOps: database, migrations, versions, ownership, storage review, seeds, deployment/recovery, associated tests/docs.
3. Education/collaboration tools: teachers, courses, assignments, reviews, tasks/milestones, associated tests/docs.
4. Lead integration: frontend/branding, public project publishing, discovery/recommendations, comments/reporting, analytics/admin, contract reconciliation, integration tests and final security review.

Each workstream owns its declared files, adds tests and a dedicated review note, and reports blockers honestly. Do not edit another stream's files without coordination. Shared schema and package changes go through the data owner; auth/security policy contracts go through identity owner. No agent may declare the full product complete. The lead reconciles integration, executes available checks, and records remaining limitations against all seven implementation phases.
