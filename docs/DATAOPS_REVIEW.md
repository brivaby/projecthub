# Database, releases, ownership, storage and DevOps workstream

## Implemented

The revised schema has 49 models. The original initial migration is preserved and a new forward migration introduces verified-password identity fields, hashed email challenges, policy consents, private profile preferences, extended visibility, project publication states, shared owners, ownership proposals, release snapshots, course/class/assignment/submission models, workspace tasks, blocks, followed categories, saved searches, notification preferences, follow/history records and platform settings.

Ownership remains compatible with `Project.ownerId` as the primary owner; `ProjectOwner` contains every additional owner. The forward migration backfills each existing primary owner. `ProjectOwner.userId` uses a restrictive foreign key so an uncontrolled hard-delete cannot destroy shared ownership. Account deletion must explicitly choose another active co-owner before anonymizing the departing primary owner, or unpublish a sole-owner project. The application uses soft account deletion.

A PostgreSQL trigger rejects new/updated collaborator rows unless the current user has an active, verified exact `vicacademy.org` email and accepted collaboration rules. It does not replace live application checks after verification changes or suspension.

Project release APIs support draft creation, publication, archive and restoring content as a new draft snapshot. Clean same-project files are attached under a project row lock. Previously versioned files are immutable references and must not be deleted through ordinary file deletion. A restoration never changes visibility, ownership, course permissions or previous releases, but it always invalidates public publication state: DRAFT for independent work or PENDING_REVIEW for managed-course work. Required submissions are reset and stale grades cleared. Version label uniqueness and release lookup scope prevent cross-project changes.

Ownership proposals are expiring two-party actions: the current primary owner can propose a transfer, and an authorized owner can invite an additional owner. Nothing changes before the intended eligible recipient accepts. Both parties are rechecked at acceptance; a changed primary owner invalidates authority. Notifications are queued for existing owners and the recipient without exposing email addresses in API data. The former primary owner remains a co-owner after transfer.

`archive-safety.ts` inspects ZIP central/local directories without extracting files to disk. It rejects unsafe paths, symlinks, encrypted/multipart/ZIP64 archives, nested archives, executable members, ambiguous Unicode-path fields and invalid bounded decompression. Defaults cap 1,000 members, 100 MB expanded size and ratio 100. The helper also enforces a configurable total project quota (default 250 MB). These are additional controls around malware scanning, not a substitute for it.

The development seed requires `DEV_SEED_PASSWORD` from the environment and uses the shared scrypt password helper. It contains synthetic verified/unverified Vic accounts, an external account, teacher/admin, classes/courses, assignments/rubrics, private grades, public/private/unlisted/institution/course work, shared ownership, release history, requests, notifications, analytics and an integrity report. It is disabled in production.

CI generates ephemeral credentials at runtime rather than embedding passwords. A database backup command runs real `pg_dump` and supports AES-256-GCM encryption with an environment key. Production backups require encryption. Retention maintenance removes expired sessions/challenges and aged analytics/sent email records, and marks expired requests/proposals; it does not purge project content. `/api/health` checks the database and production integration configuration without exposing credentials.

## Checks performed

- 20 lifecycle/storage unit tests passed against actual ZIP parsing/inflation and pure release/ownership policy functions.
- Full dependency installation was retried once with a writable cache and bounded retry settings. It failed with registry DNS `ENOTFOUND` for the AWS S3 package.
- Prisma packages/binaries remain unavailable, so schema validation, Prisma generation, real migration application/schema-drift checks and lifecycle API integration tests could not be executed here.
- PostgreSQL/Docker limits inherited from the earlier turn remain; no successful database migration or cloud deployment is claimed.

## Integration requirements and remaining risks

The lead must include async multi-owner project authorization on every owner-only route, reject unauthorized draft/archived version file metadata/downloads, and prohibit deleting version-bound files. Public discovery must include only published rights-confirmed, authorized visibility records. Existing projects receive status DRAFT under the additive migration so owners can re-attest publication rights instead of treating prior data as consent.

PostgreSQL constraints and schema relation inverses need a real Prisma validation pass before release. Backups must be copied to a separate protected store, restore-tested, monitored and included in operator retention policies. The backup command alone is not an automated external backup service. S3 object versioning/replication and database PITR require provider configuration. Bounce webhooks, direct-to-quarantine large Vercel uploads and production load/capacity tests remain operational integration work.
