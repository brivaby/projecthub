# Identity, eligibility, and authorization workstream review

## Implemented

Authentication now uses passwords and cryptographically random database sessions rather than the previous email-link-only sign-in. This is a documented custom-auth implementation using Node's built-in `crypto.scrypt`: N=32768, r=8, p=1, a random 16-byte salt, and a 64-byte derived key. Verification compares fixed-length values with `timingSafeEqual`. Passwords are bounded to 12–128 characters for registration/reset/change; login accepts existing stored credentials without truncation. Opaque 256-bit session tokens are stored only as SHA-256 hashes in PostgreSQL and sent in HttpOnly, SameSite=Lax, production Secure cookies. Password/email changes and recovery revoke sessions. Active-session inspection/revocation is available at `/account`.

Registration requires name, normalized email, password confirmation, and separate terms/community/privacy consents; optional student ID/institution stay private. Accounts are inactive until verified. Registration, resend, and recovery issuance use generic replies to reduce account enumeration. A per-address PostgreSQL advisory lock serializes registration, avoiding duplicate-address conflict disclosures. Existing unverified registrations may be replaced only outside the resend cooldown and with a newly issued code; an older code is invalidated, preventing a previous unverified password from being activated accidentally.

Verification uses exactly six numeric digits from cryptographic randomness. HMAC hashes bind the code to user, email, and purpose; code records expire, permit a configurable bounded attempt limit (five by default), and are consumed once under row locks. Failed attempts commit before a validation error is returned. Resend invalidates previous codes and has a configurable cooldown (one minute by default) plus hourly rate limits. Verification, password reset, and email change use separate purposes. Pending verification email HTML is AES-256-GCM encrypted at rest with a key derived from AUTH_SECRET; the shared outbox decrypts only for delivery and removes code bodies after successful sending. Key rotation requires draining or expiring pending challenge emails first.

The `/api/account` endpoints cover register, resend, verify, login/logout, reset, password change, email-change confirmation, active sessions, and collaboration-rule consent. Email changes are verified at the new address before replacement and clear collaboration consent. Essential account-security messages notify the previous verified address on password or email changes. Login/password mutation use locked live user records to prevent a concurrent reset from creating an old-credential session or overwriting a newer password.

## Collaboration restrictions

`verifiedVic(user)` accepts only an active, current verified email whose normalized domain is exactly `vicacademy.org`. It rejects look-alike Unicode domains, suffix attacks, subdomains, multiple @ characters and trailing-dot domains. `collaborationEligible(user)` additionally requires recorded collaboration-rule acceptance. Administrative role never changes the eligibility result.

The formal request and collaborator routes reload current user records and check eligibility for both the acting account and requester/member. They enforce approval, block relationships, request expiry, state transitions, clone policy, owner scope, and owner-only private notes. Request submission/decisions and membership changes create audit/activity records. Auto-clone approval occurs only when the owner explicitly configured AUTO and the requester supplied required licensing consent; restricted files are not copied automatically.

`assertWorkspaceAccess()` requires eligibility plus actual primary ownership, co-ownership or approved membership. A global administrator is not automatically a workspace member. Blocked non-owner relationships deny workspace access. The workspace page links account eligibility and embeds the education workstream's task component.

`canManageProject()` resolves primary/co-owner authority and administrative moderation. `canAccessProject()` adds scoped course and institution visibility, while `canReviewCourseProject()` grants read-only review to the assigned teacher or an approved teacher membership. This teacher-review scope does not grant project mutation or workspace rights. Institution/course student visibility is lost when their email ceases to be verified Vic Academy email.

## Endpoints and UI

- `/register`, `/login`, `/verify`, `/recovery`: accessible native form controls with bounded input, verification-code autocomplete, explicit errors, and resend workflow.
- `/account`: password/email changes, collaboration-rule acceptance, and device-session revocation.
- `/api/account/register`, `/resend`, `/verify`, `/login`, `/logout`, `/recovery`, `/password`, `/email`, `/sessions`, `/collaboration-rules`.
- Legacy Auth.js API paths return 404 and cannot issue bypass sessions.

All custom browser mutations use same-origin checks. Account bodies are bounded to 16 KiB before JSON parsing. Authentication and code actions have database-backed rate limits; trusted reverse-proxy source limits activate only when TRUST_PROXY is configured and the ingress overwrites forwarded addresses.

## Verification performed

`tests/identity.test.ts`: 24 tests for exact domain/eligibility, verification-code format, HMAC binding, expiry/attempt/single-use state, encrypted outbox material, password hashing and request transitions.

`tests/challenges.test.ts`: six mocked-database service tests for attempt persistence, lockout, replay, expiry, resend cooldown, prior-code invalidation and encrypted email enqueueing. These validate service behavior, not real PostgreSQL row-lock scheduling.

`tests/integration-authorization.test.ts`: fourteen mocked transaction/route tests for locked ownership/eligibility rechecks and draft/quarantine cover isolation. These are not real database integration tests.

`tests/project-access.test.ts`: six mocked-context tests for changed-email course access, teacher review scope, global-admin workspace non-bypass, approved eligibility and blocked membership.

The source was formatted and parsed locally. Full Prisma generation, integration migrations, typechecking, linting, SMTP delivery and browser journeys remain subject to the environment's package/database restrictions; the lead must report their actual final check results. No production readiness claim is made by this workstream.

## Operational and residual requirements

Use an independent random AUTH_SECRET of at least 32 characters. SESSION_TTL_SECONDS defaults to seven days and is bounded to one hour through thirty days. Configure VERIFICATION_TTL_SECONDS (120–1800, default600), VERIFICATION_MAX_ATTEMPTS (1–10, default5), and VERIFICATION_RESEND_SECONDS (30–300, default60) as needed. Configure SMTP and run the email worker so verification codes are actually delivered. CAPTCHA/edge bot controls are still needed before large public registration campaigns; application rate limits are not a complete distributed bot defense. Do not trust incoming forwarded headers without an overwriting ingress.

Recovery email ownership is the account recovery factor. Two-factor authentication, backup recovery codes, suspicious-login device intelligence and institutional roster verification are future additions. Terms/legal policy version values are configuration, not legal advice. Administrator/teacher assignment is never available in public registration.
