# Vic Academy ProjectHub data model

The Prisma schema defines49 normalized models and two versioned PostgreSQL migrations. The initial migration is preserved; the additive Vic Academy migration adds identity verification, consent, education, versioning, shared ownership and preference records without dropping previous project data.

| Area | Models |
|---|---|
| Identity and consent | User, Profile, Session, EmailChallenge, Consent; legacy Account/VerificationToken remain for migration compatibility |
| Academic organization | Institution, Course, CourseMembership, ClassGroup, ClassMember, Assignment, Submission, CourseCollection, CollectionProject |
| Projects and releases | Project, ProjectOwner, OwnershipTransfer, ProjectVersion, ProjectFile, ProjectLink, Contributor |
| Taxonomy/licensing | Category, Tag, ProjectTag, LicenseDefinition |
| Interaction/access | Collaborator, Request, Comment, Engagement, Rating, UserBlock, ProjectFollow |
| Discovery/analytics | ProjectView, Recommendation, ViewHistory, FollowedCategory, SavedSearch, Activity |
| Operations/preferences | Notification, NotificationPreference, EmailEvent, Report, ModerationAction, AuditLog, RateLimit, PlatformSetting |

`Role` includes USER, TEACHER and ADMIN. Verified Vic Academy student eligibility is derived from the current active identity, current verified exact-domain email, and collaboration-rule consent rather than a stale role flag. User email is normalized, unique, nullable for deleted accounts, and additionally constrained/indexed case-insensitively in PostgreSQL.

EmailChallenge separates VERIFY, RESET and EMAIL_CHANGE purposes. It stores a keyed code hash, expiry, bounded attempts and consumption time. A partial unique index permits one unconsumed challenge per user/purpose; issuance invalidates old challenges under a user row lock. Consent rows record policy/version acceptance independently of private profile display settings.

Project.ownerId is the primary owner; ProjectOwner is the multi-owner junction. The migration backfills every primary owner. OwnershipTransfer requires expiring sender/recipient confirmation and records whether it transfers primary ownership or adds a co-owner. Previous ownership remains attributed. Account deletion is soft and must reassign the primary owner when an active co-owner survives.

ProjectVersion records immutable content snapshots and draft/published/archived release state. ProjectFile.versionId preserves release-file relationships. Restoring content creates a new draft and invalidates the current project's public publication/review state. Ownership and visibility never come from a release snapshot. Version labels are unique per project.

Visibility supports PUBLIC, PRIVATE, UNLISTED, INSTITUTION, COURSE and SCHEDULED. A separate project status controls draft/review/published/archive/moderation state. Existing records become DRAFT under the additive migration so old data is not treated as an integrity attestation. The application must require rights and contributor/privacy attestations before publication.

Course memberships have an approval state. Assignments store rubrics, deadlines, review requirements and scoring bounds; Submission contains private grades and feedback. Public collection membership never grants access to restricted project data. WorkspaceTask supports assignee, status, deadline and milestone flags.

The shared Request model discriminates COMMENT, COLLABORATION and CLONE. Payloads are validated by type; status/permission/project/requester are indexed relational fields. A partial unique index allows one active pending/needs-information request per requester/project/type. Private owner notes must never be included in requester/public DTOs. Replies use self-referential Comment.parentId. Likes and bookmarks share a unique typed Engagement key; Rating has a database1–5 check.

ProjectView stores a signed-pseudonymous daily hash, daily deduplication key, total repeated views and referrer hostname; no raw visitor IP is retained. ViewHistory is a separate authenticated private recommendation input that users can clear or disable. Preferences are separate from public portfolio fields, and notification preferences are per user/event kind.

## Indexes and database defenses

Indexes cover identity verification/eligibility, publication visibility/status/time, owners, categories, tags, requests/status, memberships, unread notifications, email retry scheduling, audit actors, project activity and private history. The initial search GIN index covers title/summary/description; expanded multi-entity search query plans still need real production-size evaluation.

PostgreSQL checks enforce rating bounds, file sizes, nonnegative grades/assignment maxima, challenge purpose/attempts, release states and non-self ownership/block relationships. A collaborator INSERT/UPDATE trigger independently requires active verified exact-domain Vic eligibility and rules consent. Live application authorization remains mandatory after email changes, revocation or suspension; a historical collaborator row is never sufficient by itself.

## Migration verification

```sh
npm run db:validate
npm run db:deploy
npx prisma migrate status
```

These commands must run against a fresh disposable PostgreSQL database before release. In the authoring sandbox, Prisma was unavailable and PostgreSQL shared-memory allocation was prohibited; no applied-migration success is claimed. The forward SQL was reviewed statically, not executed. After installation, compare actual and expected schema with Prisma migrate diff and inspect functional-index/check/trigger differences that Prisma cannot fully represent.

Use `prisma migrate dev` for reviewed future development migrations and `prisma migrate deploy` for controlled staging/production release steps. Preserve migration history. Use a direct connection for migration operations and provider-compatible pooling for runtime traffic.

## Retention and restoration

See [backup and recovery](BACKUP_RECOVERY.md). Retention settings are stored under PlatformSetting key `retention`. Maintenance removes expired sessions/challenges and aged sent-mail/analytics records; it does not silently delete project releases, stored files or audit evidence. Hard purges, backup expiry and operator-specific privacy obligations require an explicit audited policy.
