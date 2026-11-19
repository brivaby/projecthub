# Verification status and implementation boundaries

This is a substantial source implementation, **not a certified production-ready release**. No external deployment or production service configuration was performed.

## Latest local verification

- Vitest passed all 150 tests across 12 files.
- The two offline intake regression tests passed. They exercise scanning, rendering, source links, revision retention, deletion, and recovery after a temporary import failure.
- Online lockfile generation could not resolve the npm registry. Offline generation also failed because the AWS SDK metadata was absent from the npm cache.
- Prisma, ESLint, and Playwright are absent from the local install. The production build, real PostgreSQL concurrency assertions, SMTP delivery, and browser checks remain unverified here. The CI workflow runs them with disposable PostgreSQL, Mailpit, Chromium, and WebKit.

## Earlier verification

| Check | Result |
|---|---|
| Vitest domain policies, validation, ranking, recommendation diversity | 35 passed |
| Vitest email escaping, outbox claim/no-work/success/retry/failure | 5 passed (SMTP/database mocked) |
| Vitest rate-limit threshold and identifier hashing | 2 passed (database mocked) |
| TypeScript syntax parser | 76 TypeScript files parsed successfully; zero syntax errors |
| Full dependency installation | Blocked: registry DNS/network unavailable; Auth.js/Prisma/AWS packages not cached |
| Full TypeScript check | Attempted, blocked by missing packages/generated Prisma types; not passed |
| Prisma validate/generate/migrate | Attempted; Prisma command unavailable because packages are missing |
| PostgreSQL integration | Attempted isolated initdb; sandbox denies shared-memory allocation |
| Docker integration | Docker daemon unavailable |
| ESLint | Attempted; ESLint command unavailable |
| Next.js build and local browser preview | Build attempted; blocked at Prisma generation; preview not run |
| Playwright journeys | Written, not run |
| Responsive/accessibility behavior | Responsive CSS, labels, focus, semantic controls supplied; browser/assistive-tech audit outstanding |

Never represent unit tests with mocked adapters as proof of real PostgreSQL or SMTP delivery. The runtime code uses real Prisma, SMTP and storage adapters; mocks exist only in unit tests.

## Phase record

1. **Foundation:** Next.js/TypeScript configuration, auth, schema, layout, public profiles, preferences. Browser/database auth verification outstanding.
2. **Publishing:** validated CRUD, custom covers, private/public/unlisted rules, archive/unpublish/delete, bounded uploads, storage and scanner adapters, dedicated pages. Real migration/upload/download verification outstanding.
3. **Interaction:** engagement toggles, comments/replies, approval requests, notification center, email outbox and review UI. Unit checks pass; real transactional and email journeys outstanding.
4. **Discovery:** search/filter/sort/pagination, weighted ranking, interest/save recommendations, view dedupe, owner analytics. Domain tests pass; query plans, migration/search integration and load testing outstanding.
5. **Collaboration/cloning:** approved access, collaborator permissions/revocation, private activity workspace, license consent, derivative attribution. Browser approval and revocation tests outstanding.
6. **Administration/operations:** protected moderation dashboard/actions, audit trail, export/deletion, Docker/CI/deployment documentation. Full lint/build/E2E and release security review outstanding.

## Remaining depth relative to the full product brief

- Discovery has a documented 500-matching-project ranking cap. Full-catalog materialized ranking, advanced relevance, and scale testing are not complete.
- Dedicated project pages and metadata are implemented; social preview images, production SEO, and uploaded-avatar management are not.
- Recommendation inputs currently include interests, technologies and saved work. Viewing-history personalization, explicit followed-category controls and automated suspicious-activity detection are not complete.
- Native form controls and dialog keyboard behavior are provided, but WCAG auditing and automated accessibility scans remain required. Dark mode is not implemented.
- Numeric ratings, database constraints, endorsement toggles and highest-rated sorting are implemented. Cross-project reputation aggregation remains extension work.
- Private workspaces contain files, team and activity; task boards, private messaging, shared document editing, and fine-grained editor/manager metadata editing are not implemented.
- Comments support a displayed reply level and owner-approved edit requests. Mentions and arbitrary-depth thread display need further work.
- Needs-information decisions support authenticated requester responses and resubmission, with owner email/in-app notification; this path needs real database/browser verification.
- SMTP acceptance/retries are recorded; provider delivery/bounce webhooks, per-notification-type preferences, collaborator-specific separate welcome email dispatch, and email-template previews are not complete.
- Admin moderation supports listing/actions and adding taxonomy. Full CRUD taxonomy tooling, configurable ranking weights, detailed suspicious-activity investigations and large-dataset admin pagination are not complete.
- Account anonymization/export exist; operator-specific retention jobs, object hard purge, backup erasure policies, and legal notices must be completed before launch.
- Vercel large-file support needs the direct-to-quarantine upload architecture described in DEPLOYMENT.md.
- Browser tests cover core journeys but not every endpoint's success and failure matrix; full integration coverage, load tests, license/consent edge cases and account-deletion tests remain release work.

## First actions on a fully enabled machine

Install dependencies, generate and validate Prisma, execute the migration on a disposable PostgreSQL database, inspect schema drift, run full TypeScript/lint/build, then run browser tests against seeded PostgreSQL plus Mailpit and ClamAV. Fix any resulting failures before deploying. Generate and commit a complete lockfile, review dependency advisories, configure service credentials, and complete the remaining product depth according to release scope.
