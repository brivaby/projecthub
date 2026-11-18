# ProjectHub

A Next.js / TypeScript academic project showcase with PostgreSQL persistence, verified email sign-in, approval-based collaboration and cloning, private object storage, an email outbox, discovery, moderation, and privacy-safe analytics.

**Status:** substantial implementation, not a verified production release. The current unit suite contains 150 passing tests. Full installation, Prisma generation, database migration execution, lint, production build, and browser journeys remain unverified because the environment blocks registry access and PostgreSQL shared memory. Read [verification status](docs/VERIFICATION.md) before deploying.

## Browse student projects

Open `ProjectHub Preview.html` in a browser to browse the bundled student projects.
Keep `preview-projects` beside the HTML file. The offline catalog and the database-backed
Next.js application have separate startup instructions.

```sh
python3 scripts/watch-preview.py
```

The watcher imports browser-ready submissions from the directory that contains
`projecthub`. On macOS, you can also open `Watch Student Projects.command`.
See [local preview and intake](docs/LOCAL_PREVIEW.md) for supported submissions.

## Local setup

Requires Node 20.19+ (Node 22 recommended), npm, Docker, and network access for dependencies.

```sh
cd projecthub
cp .env.example .env
```

Set `AUTH_SECRET`, `ANALYTICS_SECRET`, and `CRON_SECRET` to independent values generated with `openssl rand -hex 32`. Set `POSTGRES_PASSWORD`, and match it in `DATABASE_URL`. The example database URL is development-only. Keep `.env` out of version control.

```sh
docker compose up -d db mailpit
npm install
npm run db:validate
npm run db:deploy
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:3000**. Use this canonical hostname consistently with `APP_URL` and `AUTH_URL`; changing to localhost without updating those values will fail CSRF origin checks. Mailpit captures actual SMTP messages at http://127.0.0.1:8025. Register or sign in with an email address, open the message in Mailpit, and follow the single-use link.

In a second terminal, start email delivery with environment variables loaded:

```sh
node --env-file=.env --import tsx scripts/email-worker.ts
```

`next dev` and Prisma CLI load `.env`; standalone `tsx` scripts do not. For other scripts use `node --env-file=.env --import tsx scripts/<script>.ts`.

Local files are persisted in `.data/uploads`, outside `public`. Without `SCAN_URL`, uploads remain quarantined and cannot be downloaded. This is intentional; there is no fake clean-scan fallback.

For real local malware scanning:

```sh
docker compose --profile scan up -d clamav
# Wait for ClamAV signature initialization; this can take several minutes.
# Set SCAN_TOKEN to a random value, and SCAN_URL=http://127.0.0.1:3311 in .env.
node --env-file=.env --import tsx scripts/scan-server.ts
# In another terminal, scan already-quarantined uploads:
node --env-file=.env --import tsx scripts/rescan-files.ts
```

Development accounts use `amara@example.test`, `joshua@example.test`, `sarah@example.test`, `michael@example.test`, and `admin@example.test`. They have **no passwords and no authentication bypass**. Sign in through captured Mailpit messages. The administrator is for development only. Never run the seed in production.

## Validation

```sh
npm run db:validate
npm run db:deploy
npm run typecheck
npm run lint
npm test
npm run build
MAILPIT_URL=http://127.0.0.1:8025 npm run test:e2e
```

Use a dedicated disposable database for browser tests: they insert sessions and create/delete records. `APP_URL`, the browser base URL, and `TEST_URL` must use the same origin. Playwright fixtures write database sessions only in tests; the application contains no test sign-in endpoint. Install browsers with `npx playwright install chromium webkit`.

After the first successful full install, commit the generated `package-lock.json` and use `npm ci` in CI and Docker. A lockfile could not be generated for all dependencies in the authoring environment. Do not treat the supplied version ranges as a dependency security audit.

## Documentation

- [Architecture and flows](docs/ARCHITECTURE.md)
- [Database model and migrations](docs/DATA_MODEL.md)
- [API reference](docs/API.md)
- [Ranking and recommendations](docs/RANKING.md)
- [Security and operations](docs/SECURITY.md)
- [Vercel, Docker, and PostgreSQL deployment](docs/DEPLOYMENT.md)
- [Verification and remaining work](docs/VERIFICATION.md)

No user workspace files outside the new `projecthub` directory are used or modified by this application.
