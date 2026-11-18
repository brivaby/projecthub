# Architecture

## Components

Next.js App Router provides server-rendered public pages and JSON route handlers. Interactive forms are client components. Prisma is the persistence boundary; PostgreSQL is the source of truth for accounts, projects, authorization, requests, rate limits, and engagement. There is no in-memory project database or mock network layer.

Auth.js uses the Prisma adapter, database sessions, and Nodemailer verified email links. Sign-in and registration are one flow. Links are single-use and expire after 15 minutes; Auth.js manages verification token hashing. Suspension is checked when signing in and on every protected API operation. Project policies enforce ownership and visibility on the server. Password reset is replaced by requesting a new verified sign-in link; there are no application passwords.

Storage has a local development driver and an S3-compatible production driver (including private R2 buckets). Files get random UUID object keys and retain a safe original display name. Uploads are size/type/signature-validated, scanned, and quarantined unless clean. Public cover images are explicitly classified as covers; other files always need approval. Signed downloads last 60 seconds.

The email outbox is committed in the same transaction as each request and approval. The worker claims pending messages using PostgreSQL `FOR UPDATE SKIP LOCKED`, sends SMTP, records status, and retries failures. Notifications do not expose email addresses. Review links require authentication and ownership; no bearer link grants review authority.

## Source layout

```text
src/
  app/                  pages and API handlers
    api/auth/           Auth.js endpoints
    api/projects/       discovery, CRUD, files, comments, requests, engagement
    api/requests/       atomic decisions
    api/admin/          role-protected moderation
    api/profile/        settings, export, deletion
    api/cron/email/     protected outbox dispatch
    projects/[id]/      project, editor, private workspace, analytics
  components/           accessible forms, cards, interaction controls
  lib/                  database, policies, validation, ranking, integrations
  auth.ts               verified email authentication
prisma/
  schema.prisma
  migrations/           PostgreSQL DDL and integrity constraints
  seed.ts               idempotent development records
scripts/                email and scanner processes
tests/                  domain tests, mocked email/rate-limit unit tests, real E2E journeys
docs/                   setup, API, model, operations, known gaps
```

## Main flows

1. **Discover:** public queries exclude deleted/archived projects. Search combines PostgreSQL text search with tag matching; filters are server-side. All project-listing links use a new tab with `noopener noreferrer`.
2. **Publish:** sign in, complete a validated form, select visibility and licensing, save, then upload assets with progress. Files are separate operations so a failed upload does not destroy a saved project. A retry message reports partial success.
3. **Request:** an authenticated user submits validated collaboration details, clone terms/consent, or a proposed comment. The transaction creates the request, in-app notifications, and deduplicated owner/requester email events.
4. **Approve:** the owner decides under a row lock. Approval adds a collaborator or publishes a comment. Clone approval is recorded and unlocks file access; it does not copy files. Repeated approval cannot repeat side effects.
5. **Derive:** a new project can reference an original only after the current user has an approved clone request. Original attribution is immutable through the normal editor. Public derivatives appear on the original page.
6. **Manage:** owners edit, unpublish, archive, soft-delete, inspect private analytics, and revoke collaborators. Admin actions create moderation and audit records.
7. **Privacy:** profile visibility and notification preferences are editable. Users can export data or delete their account; deletion invalidates sessions and unpublishes owned projects.

## Decisions

A typed shared Request table replaces three near-identical request tables. Its discriminant, payload validation, partial unique index, and locked transitions provide one approval policy and outbox path. Replies use a self-referential Comment relation, avoiding a separate reply model with duplicated fields. Likes/bookmarks share an Engagement table with a composite unique key. Roles are a database enum; collaborators use a separate permission enum.

Accessible native controls provide the component baseline without adding a large UI dependency. Typography uses system sans-serif and Georgia so builds do not depend on external font downloads. Covers include original code-based illustrations and support uploaded scanned images. Public prose is rendered as escaped text, not arbitrary HTML.
