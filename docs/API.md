# JSON API

Route handlers return JSON. Errors generally have `{ "error": { "code": "403", "message": "…" } }`; Zod failures add `fields`. Auth.js endpoints follow Auth.js responses. Cron unauthorized responses use a minimal error string. Bodies and tokens are never logged.

Authenticated routes use Auth.js HttpOnly database-session cookies. All browser mutations require an `Origin` equal to `APP_URL`; use the canonical origin in API clients as well. No client-supplied user or owner ID authorizes an operation. Rate limits are atomic PostgreSQL counters shared by server instances.

| Method and path | Access | Operation |
|---|---|---|
| GET/POST `/api/auth/*` | Auth.js | CSRF, sign-in, verification, session, sign-out |
| GET `/api/projects` | Public | q, category, level, type, institution, course, technology, license, open, since, sort, page |
| POST `/api/projects` | Signed in | Validated project creation; private default |
| GET `/api/projects/:id` | Visibility checked | Project metadata; no storage keys |
| PATCH `/api/projects/:id` | Owner/admin | Complete validated project update |
| DELETE `/api/projects/:id` | Owner/admin | Soft deletion and unpublish |
| PATCH `/api/projects/:id/lifecycle` | Owner/admin | ARCHIVE, UNARCHIVE, UNPUBLISH |
| POST `/api/projects/:id/files` | Owner/admin or contributor+ | Multipart `file`; optional `isCover=true`; max 25 MB |
| GET `/api/files/:id` | Approved access | Clean file response or 60-second private signed URL |
| DELETE `/api/files/:id` | Owner/admin | Remove file and stored object |
| GET `/api/covers/:id` | Project visibility checked | Clean explicitly-publicized cover image |
| POST `/api/projects/:id/requests` | Signed in | Typed comment, collaboration, clone request |
| PATCH `/api/requests/:id` | Owner/admin; cancellation by requester | Decision and response; requester resubmission |
| POST `/api/projects/:id/comments` | Authorized commenter | Direct comment/reply, checked approval policy |
| PATCH/DELETE `/api/comments/:id` | Author; removal by owner/admin | Edit or hide comment |
| POST `/api/projects/:id/rating` | Signed in, non-owner | Upsert integer score 1–5 |
| POST `/api/projects/:id/engagement` | Signed in | Toggle `{kind:"LIKE"}` or `{kind:"BOOKMARK"}` |
| POST `/api/projects/:id/views` | Public | Signed pseudonymous visitor dedupe; optional referrer URL |
| PATCH `/api/projects/:id/collaborators` | Owner/admin | Existing member permission or null to revoke |
| GET `/api/recommendations` | Signed in | Private personalized discovery result |
| GET/PATCH `/api/notifications` | Signed in | Own latest notifications / mark all read |
| PATCH `/api/profile` | Signed in | Name/profile/preferences |
| GET `/api/profile` | Signed in | JSON account export attachment |
| DELETE `/api/profile` | Signed in | Account deletion/anonymization |
| POST `/api/reports` | Signed in | Report public project/comment |
| POST `/api/admin` | Admin | Feature, archive, suspend, moderate, resolve report, add category/tag |
| POST `/api/cron/email` | `Authorization: Bearer CRON_SECRET` | Dispatch up to 20 outbox records; expire rate buckets |

## Example collaboration request

```json
{
  "type": "COLLABORATION",
  "message": "I would like to help test the sensor prototype.",
  "permission": "CONTRIBUTOR",
  "details": {
    "skills": "Arduino and Python",
    "contribution": "Sensor calibration",
    "responsibilities": "Test plan and documentation",
    "availability": "Four hours per week",
    "communication": "In-app notifications"
  }
}
```

A clone request requires `reason`, `intendedUse`, `modifications`, `visibility`, and `licenseAgreed:true` under details. A comment request carries the proposed comment in `message` and may have `details.context`.

Request statuses are PENDING, ACCEPTED, REJECTED, NEEDS_INFO, CANCELLED, COMPLETED. Only pending/needs-info requests can be resolved or cancelled; accepted requests can be marked completed by the owner. A requester may resubmit a NEEDS_INFO request as PENDING with a response of at least ten characters. Completion retains collaboration access; revocation is explicit. Revocation of collaborators is separate from approved clone licenses, which are not silently rescinded.

## Limits

Requests: 8/hour/user. Publishing: 10/hour/user. Uploads: 20/hour/user. Comments: 10/10 minutes/user. Reports: 5/hour/user. Engagement: 30/minute/user. Verification links: 5/hour/address. General protected edits use 30/minute/user. View source limits require `TRUST_PROXY=true` behind a proxy that overwrites forwarded headers.
