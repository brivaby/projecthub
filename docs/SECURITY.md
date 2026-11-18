# Security and privacy operations

## Implemented controls

- Auth.js verified single-use email links, database-backed sessions, trusted-provider token handling, and no application passwords.
- Server-side active-account, role, ownership, visibility, and membership checks. Private workspace and analytics pages re-check authorization.
- Zod validation on user JSON payloads; Prisma and bound SQL parameters rather than interpolated user SQL.
- Escaped plain-text project/comment rendering; HTML escaping in email templates; HTTPS-only external project/profile links. External URLs are never fetched automatically by the app.
- Same-origin checks on custom mutation routes. Auth.js handles its own CSRF flow. Signed-in routes require cookies rather than requester-supplied IDs.
- Atomic database rate limits, unique engagements, signed viewer cookies, daily view dedupe, and conservative bot filtering.
- Upload extension, filename, MIME, size, and header-signature validation. Multipart streams are bounded before parsing. Source files are accepted as ZIP archives, not executable uploads. No archive extraction is performed.
- Private storage, random object keys, malware quarantine, real ClamAV adapter integration, approved access, short-lived signed downloads, attachment responses, and `nosniff`.
- Security headers including CSP, frame denial, restrictive permissions, and referrer policy. No arbitrary embedded iframes or rich HTML.
- Audit records for project changes, request decisions, moderation, collaborator changes, file removal, and account deletion.
- Profile privacy, notification preferences, authenticated data export, account deletion/session invalidation, and email addresses excluded from public selectors.

## Before launch

The code has not passed a complete build, database integration, browser, penetration, accessibility, or load test in the authoring environment. Treat these as release requirements, not assumed outcomes.

Configure a verified SMTP sending domain, SPF/DKIM/DMARC, HTTPS canonical `APP_URL`/`AUTH_URL`, independent strong secrets, trusted proxy behavior, managed PostgreSQL TLS, backups, a private S3/R2 bucket with restricted IAM, malware scanning, and private monitoring. Restrict the scan service to your network and use authenticated transport. Do not deploy Mailpit or local storage publicly.

Run application and workers as non-root. Apply edge request-body limits and platform WAF/bot rules. The in-app upload boundary is 25 MB; Vercel function limits may require direct-to-quarantine presigned uploads for large files. Keep storage origins private and block executable/HTML content from public rendering.

The current CSP allows inline scripts/styles for Next.js hydration. Move to per-request nonces and a stricter script policy after testing framework output. TLS/HSTS termination belongs to the production ingress. `trustHost:true` assumes the deployment controls forwarded host headers; enforce an allowlisted canonical host at ingress.

The outbox guarantees unique application enqueueing and exclusive claims, not exactly-once SMTP delivery. A provider may accept mail and fail before acknowledgement. Stable Message-ID improves dedupe but cannot guarantee it. A process crash in SENDING leaves the record for manual reconciliation; investigate provider logs before resetting it to RETRY to avoid double-delivery. Monitor FAILED and old SENDING records. Delivery status means SMTP accepted, not inbox delivery; provider delivery/bounce webhooks are not implemented.

Set retention limits for audit records, object files, deleted projects, database backups, email-event content, and anonymous analytics. The application provides account export/anonymization, not a full legal compliance program. Supply the operator’s identity/contact, privacy notice, terms, copyright policy, and deletion SLA before opening registration broadly.

No built-in password reset is needed for passwordless authentication. An email sign-in link performs account verification and access recovery. The generic email template catalog includes verification/recovery terminology for future provider changes.

## Authorization matrix

| Action | Visitor | Signed-in unrelated user | Collaborator | Owner | Admin |
|---|---|---|---|---|---|
| Public/unlisted page | Yes | Yes | Yes | Yes | Yes |
| Private page | No | No | Yes | Yes | Yes |
| File download | No | Approved clone only | Yes | Yes | Yes |
| Upload file | No | No | Contributor/editor/manager | Yes | Yes |
| Edit project metadata | No | No | No in current version | Yes | Yes |
| Direct comment | No | If approval disabled | Commenter+ | Yes | Yes |
| Resolve requests | No | Cancel own only | Cancel own only | Yes | Yes |
| Change collaborators | No | No | No | Yes | Yes |
| Private analytics | No | No | No | Yes | Yes |
| Moderate platform | No | No | No | No | Yes |

All file access additionally requires a clean scan. Project licensing still applies after access is granted. User roles cannot be promoted through the profile API. Production administrators must be provisioned through a controlled operational database process.
