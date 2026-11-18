# Ranking and recommendations

Popularity is calculated in `src/lib/ranking.ts`:

```text
weighted = 2 × ln(1 + dailyUniqueViews)
         + 3 × uniqueEndorsements
         + 4 × uniqueBookmarks
         + 2 × publicComments
         + 8 × approvedClones
         + 10 × approvedCollaborations
score = weighted / (1 + daysSinceProjectUpdate / 14)^1.2
```

Raw traffic has logarithmic influence. Engagement is unique by account and project. Requests contribute only after owner approval. Archived, deleted, and nonpublic projects never enter discovery. Suspended/deleted owners are excluded by the discovery query. A featured flag is an editorial decision rather than an invisible score multiplier.

Views have a signed HttpOnly anonymous cookie or authenticated session identity, hashed with an analytics secret and daily salt. The unique `(project, hash, day)` constraint prevents duplicate daily contributions. `totalViews` tracks repeated visits separately and does not influence ranking. Raw IPs and full referrer paths are not stored. Referrer hostnames and counts are visible only in owner/admin analytics.

The sign-in and engagement rate limits are database-backed. Basic user-agent bot filtering is deliberately conservative. Set `TRUST_PROXY=true` only when your proxy overwrites the forwarded header; it then adds a rate limit keyed by an HMAC of the transient source address. Otherwise no untrusted source header controls identity. Cookie clearing, Sybil accounts, owner/requester collusion, and sophisticated bots remain possible; deploy edge bot controls and suspicious-activity review before broad public promotion. Creator edits currently reset the update-based decay and could be gamed; a future accepted-activity score timestamp should be independent of editing.

Personalized recommendations use the signed-in user’s declared interests/technologies and technologies/tags/categories of saved public projects. Matching adds three points per matching tag/tool to popularity, followed by category interleaving to give different disciplines exposure. The same result is available from the private recommendations API. No other user's viewing or saving history is disclosed.

This first implementation ranks up to the latest 500 matching public projects in memory and paginates by 12. That is an explicit early-stage cap, not an unbounded full-catalog search implementation. Replace it with scheduled aggregate materialization and SQL rank/limit before large catalogs. The Recommendation table is provided for a future persisted cache. Followed-category controls, viewing-history personalization, calibrated quality scoring, anomaly detection, and learned recommendations remain extension work.
