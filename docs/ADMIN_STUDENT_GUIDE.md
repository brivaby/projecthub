# Vic Academy administrator and student controls

## Administrators: platform configuration

Open the protected administrator dashboard and find **Platform controls**. The editor loads the saved server configuration before enabling changes. Each section is saved independently and the backend records its audit event. A missing setting is labeled **DEFAULT — NOT YET SAVED**; editing a field labels the section **UNSAVED CHANGES**. A successful save shows a confirmation. Unauthorized access and network errors remain visible rather than being represented as successful changes.

**Ranking weights** control unique-view, endorsement, bookmark, comment, approved-clone and approved-collaboration influence. The decay interval and strength control how older work loses ranking weight. Values are bounded by server validation. Review discovery behavior after a configuration change and retain the audit record.

**Recommendations** enables or disables recommendations, platform personalization, and diversity. Student-level privacy choices must also allow personalization. **Publication & comments** can require review of new projects or disable ordinary public commenting; project-specific restrictions still apply.

**Data retention** configures analytics, sent-email event and used-verification-challenge periods. Saving a setting does not itself erase stored data or backups. Run and monitor the documented retention worker and separately verify database/file backup retention and recovery procedures. Consult the school's approved privacy policy before changing periods.

Reload restores persisted configuration. Save intended changes before reloading. Failed saves leave your unsaved values available for correction or retry.

## Students: notification categories

In account settings, **Choose what reaches you** lists collaboration, clone, comment, version, ownership, featured-project, moderation and security categories. Choose email and/or in-app delivery, then save that category. The account's overall email/in-app switches still apply. Newly introduced categories default to enabled unless configured otherwise.

Verification and password recovery emails are required to operate your account and may be delivered even when optional notices are muted. Collaboration notifications do not grant eligibility: workspace access still requires the currently verified exact Vic Academy email, collaboration-rule acceptance, and approved project membership.

## Blocking and unblocking

Account settings list accounts you blocked without revealing their email addresses. Select **Unblock** and confirm before allowing future interactions. Unblocking does not accept pending requests or restore permissions that an owner revoked. Use project/profile reporting to send concerns to moderators; do not include unrelated private information.

## Integration

`PlatformControls` from `src/components/platform-controls.tsx` requires no props and belongs inside the role-protected administrator page. `NotificationPreferences` and `BlockedUsers` from `src/components/notification-preferences.tsx` require no props and belong inside authenticated account settings. All controls use real API requests; authorization and validation remain on their existing server endpoints.
