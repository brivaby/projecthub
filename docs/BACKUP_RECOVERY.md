# Backup, recovery and retention

## Targets

Proposed initial objectives: database RPO 15 minutes with provider continuous backup/PITR, file RPO 24 hours with versioned replicated object storage, and service RTO four hours. These are deployment objectives, not measured guarantees. Agree them with Vic Academy, select a hosting plan that supports them, and conduct timed recovery drills.

## Database backups

Enable managed PostgreSQL point-in-time recovery and daily backups in a separate failure domain. Run the supplied manual/scheduled backup command from a restricted operational host with `pg_dump` installed:

```sh
node --env-file=.env.production --import tsx scripts/backup-database.ts
```

`DATABASE_URL`, `BACKUP_DIRECTORY` and `BACKUP_ENCRYPTION_KEY` come from the environment. Generate the encryption key through your secret manager (32 random bytes represented by 64 hex characters). The script passes connection credentials through PostgreSQL environment variables rather than command arguments. It writes a custom-format dump, optionally encrypts it with AES-256-GCM, removes the plaintext after encryption, and writes a checksum and IV/tag manifest with restrictive permissions. Production mode requires encryption. Move artifacts and manifests to a protected separate backup store; keep the key separately in a recoverable secret manager. The script does not itself provision or schedule remote storage.

If backup/encryption is interrupted, inspect and remove any partially written local dump under operational controls. Never include `.data/backups`, production environment files or encryption keys in source control or public object storage. Alert on backup failures and backup age.

## Object storage

Enable private bucket access, object versioning where supported, lifecycle retention and cross-region/account replication or scheduled protected copies. Back up object metadata consistently with PostgreSQL. Keep versions and malware scan status; never restore quarantined objects as clean without a fresh scan. A database-only restore cannot recover missing project objects.

## Recovery procedure

1. Establish a maintenance window and isolate writes; record the target recovery timestamp and incident ID.
2. Provision a fresh PostgreSQL instance and a private restore bucket. Retrieve backups through the controlled operator account.
3. Verify the backup checksum, decrypt encrypted dumps using the recorded IV/tag and separately-held key, and restore with `pg_restore --no-owner --no-acl`. Supply credentials via PostgreSQL environment variables, not command-line URLs.
4. Restore matching object versions. Keep bucket access private and quarantine objects whose scan state cannot be trusted.
5. Validate migration status, referential integrity, owner/co-owner records, current releases, course membership and private grade boundaries.
6. Rotate authentication/session secrets when responding to a compromise. Revoke all sessions and invalidate pending challenges if their integrity is uncertain.
7. Exercise sign-in/verification, project access, collaboration eligibility, a private-file download, a version restore, teacher-only feedback and administrative moderation in staging.
8. Switch traffic after acceptance, monitor errors and queue age, document measured RPO/RTO, and retain incident evidence under the retention policy.

Use an isolated staging restore at least quarterly. A backup is not considered verified until a restore has completed successfully.

## Product-level restoration

Project deletion is soft. Platform administrators can review and restore eligible projects according to the moderation policy. Version history restores content into a new draft while preserving visibility, ownership and past releases. Archived releases remain available to authorized owners. Versioned files cannot be removed through ordinary file deletion. Team projects retain other owners when one account departs.

## Retention maintenance

Configure `PlatformSetting` key `retention` with `analyticsDays` (7–3650, default90), `sentEmailDays` (1–3650, default30), and `usedChallengeDays` (1–90, default7). Run:

```sh
node --env-file=.env.production --import tsx scripts/maintenance.ts
```

Maintenance clears expired sessions/rate buckets/challenges, old anonymous analytics and private recommendation history, aged successfully-sent email bodies, and marks requests/proposals expired. It does not delete project releases, object files, failed email evidence or audit trails. Define approved legal/security retention for these records before launch; implement hard purge as an explicit audited operational process. Align database backups and object lifecycle retention with account-deletion obligations. No GDPR compliance claim is implied by these utilities.
