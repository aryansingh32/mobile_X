-- The admin console's Users page filters and sorts on banned, shadowBanned,
-- trustScore, riskScore, createdAt, lastActiveAt, and country. None of these
-- had an index, so every filtered/sorted query was a full sequential scan
-- over the whole User table — fine at a few hundred rows, not at the 10k+
-- daily-active scale the admin panel needs to manage.
--
-- NOTE: if this runs against a table that already has a meaningful number of
-- rows in production, prefer running these as CREATE INDEX CONCURRENTLY
-- statements by hand outside of a migration transaction instead of via
-- `prisma migrate deploy`, to avoid holding a write lock on User for the
-- duration of the index build.

CREATE INDEX "User_banned_idx" ON "User"("banned");
CREATE INDEX "User_shadowBanned_idx" ON "User"("shadowBanned");
CREATE INDEX "User_trustScore_idx" ON "User"("trustScore");
CREATE INDEX "User_riskScore_idx" ON "User"("riskScore");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");
CREATE INDEX "User_country_idx" ON "User"("country");
