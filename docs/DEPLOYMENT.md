# Vic Academy ProjectHub deployment

No production services were provisioned, and full release checks have not passed in the authoring sandbox. Resolve the checks and remaining scope in VERIFICATION.md before serving real students.

## Required service configuration

Use PostgreSQL with TLS and controlled migration credentials, private S3-compatible object storage, a verified SMTP sending domain, and a private malware-scanning service. Keep authentication, analytics, worker, SMTP, storage, scan and backup encryption secrets in the deployment secret manager. `.env.example` contains placeholders only; choose all real values yourself.

Use the exact canonical HTTPS origin for APP_URL. Registration requires a password and explicit policy consents; a six-digit challenge sent through the outbox activates the account. The email worker is therefore required for registration/reset/change-email flows, not just project notifications. Sessions are opaque revocable server-side records. Never seed production or depend on a development administrator.

```sh
npm install
npm run db:validate
npm run db:deploy
npm run typecheck
npm run lint
npm test
npm run build
```

The complete dependency install and lockfile are currently blocked by network restrictions. Generate and commit package-lock.json on a fully enabled machine, audit the dependency graph, and then use npm ci in CI and containers. Review both migrations on a disposable database and run the real browser journeys with SMTP capture before deployment.

## Managed PostgreSQL

Choose a maintained PostgreSQL host supporting backups/PITR and the academy's data residency/availability needs. Create separate runtime and migration credentials, require TLS, configure Prisma-compatible pooling and test connection limits. Use a direct connection for migrations. Apply migrations in a controlled release step, not from requests. Provision the first teacher/administrator through an audited operational process after verifying the real account.

## Vercel

Import the source directory as a Next.js project and configure environment variables for each environment. Set STORAGE_DRIVER=s3 and use a private S3 or R2 bucket. For R2 supply its account endpoint, scoped credentials, region auto and bucket name. The browser never receives object-storage credentials.

Build with npm run build. Apply migrations separately before release. Deploy the email worker and private scanning adapter outside ephemeral request handlers, or schedule authenticated POST requests to `/api/cron/email` using CRON_SECRET. Run retention maintenance from a protected scheduler and configure alerting on queue age, failures and quarantine backlog.

The application accepts at most25 MB per file, but Vercel function request limits still apply. Large files require a dedicated upload service or a presigned direct-to-quarantine initiation/finalization flow with server-verified object metadata and malware scan completion before publication. The current proxied multipart upload route is suited to a container deployment with appropriate ingress limits; do not advertise large-file serverless support until the direct upload flow is implemented and tested.

## Docker

The supplied multistage Dockerfile builds Next.js standalone and runs the runtime as the non-root node user:

```sh
docker build -t vic-academy-projecthub .
docker run --env-file .env.production -p 127.0.0.1:3000:3000 vic-academy-projecthub
```

Runtime secrets are injected at launch. Run PostgreSQL, SMTP, object storage and the scanner as private managed services or maintained containers with persistent storage. The standalone web image does not include all operational CLI scripts; deploy email, scanning, retention and backup jobs using controlled source-based worker images/processes.

The compose file is a local-development/staging harness. PostgreSQL requires POSTGRES_PASSWORD from the environment. Mailpit is loopback-only development email capture, and local file storage is development-only. The optional ClamAV profile requires signature initialization before scanning; never expose Mailpit or the unauthenticated ClamAV port publicly.

## Health, monitoring and recovery

`GET /api/health` checks database connectivity and required production integration configuration. It does not reveal credentials or guarantee SMTP/S3/ClamAV readiness; run protected synthetic checks for those services. Alert on error rate, database latency, email queue age/failed/old-SENDING records, scan backlog, upload failures, storage capacity and backup age. Capture identifiers and failure classes rather than private content or credentials.

Enable PostgreSQL PITR and versioned/replicated object storage, schedule encrypted backups, and conduct isolated restore drills as described in BACKUP_RECOVERY.md. Agree RPO/RTO with the academy. The provided scripts are real operational tools, not evidence that a hosted backup/monitoring service has already been configured.

Before opening registration, supply operator-approved terms, privacy/cookie/community/copyright policies, retention settings, abuse escalation contacts and safeguarding procedures. Complete accessibility, session/CSRF, domain eligibility, co-owner departure, course-grade privacy, release restoration and private-file authorization acceptance tests.
