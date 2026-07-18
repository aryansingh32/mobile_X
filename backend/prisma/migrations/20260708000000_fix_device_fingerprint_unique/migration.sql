-- Fixes device-cloning-farm detection, which was structurally broken: a
-- global UNIQUE on "deviceIdHash" meant only one row could ever exist per
-- physical device, permanently owned by whichever user registered it
-- first. Every later registration from the same device (a different user
-- account) silently overwrote that row's IP/OS/trustScore but never
-- changed its userId, so the "how many distinct users share this device"
-- check in registerFingerprint() could never see more than one user and
-- the fraud rule never fired.
--
-- NOTE: if there are already rows in production, the old unique index on
-- "deviceIdHash" must be dropped before the new compound one can be
-- created. This migration handles that. No data is deleted.

-- DropIndex (old global-unique constraint, if present)
DROP INDEX IF EXISTS "DeviceFingerprint_deviceIdHash_key";

-- CreateIndex (new compound unique — one row per user+device pair)
CREATE UNIQUE INDEX "DeviceFingerprint_userId_deviceIdHash_key" ON "DeviceFingerprint"("userId", "deviceIdHash");

-- CreateIndex (fast lookup of every user who has registered a given device)
CREATE INDEX "DeviceFingerprint_deviceIdHash_idx" ON "DeviceFingerprint"("deviceIdHash");
