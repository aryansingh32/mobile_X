-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isDiscoverFilter" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Missions" ADD COLUMN     "activeFrom" TIMESTAMP(3),
ADD COLUMN     "activeTo" TIMESTAMP(3),
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'EASY',
ADD COLUMN     "iconEmoji" TEXT NOT NULL DEFAULT '🎯',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metricType" TEXT NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RssSource" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isDiscoverFilter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDailyBonus" TIMESTAMP(3),
ADD COLUMN     "lifetimeAdsWatched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeGamesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeNewsReads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeOfferwallTasks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeScreentimeMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeShortsWatched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streakFreezes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCoinsEarned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "color" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "mobileNumber" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "trackingId" TEXT,
ADD COLUMN     "trackingStatus" TEXT;

-- AlterTable
ALTER TABLE "YoutubeVideoPool" ADD COLUMN     "isTrending" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DailyUserStats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "adsWatched" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyUserStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivityEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'HEARTBEAT',
    "currentScreen" TEXT,
    "sessionDurationSec" INTEGER NOT NULL DEFAULT 0,
    "appVersion" TEXT,
    "appVersionNumber" TEXT,
    "platform" TEXT,
    "deviceType" TEXT,
    "deviceId" TEXT,
    "timezone" TEXT,
    "traceId" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPlacement" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "adFormat" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMin" INTEGER NOT NULL DEFAULT 3,
    "intervalMax" INTEGER NOT NULL DEFAULT 6,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 45,
    "maxPerSession" INTEGER NOT NULL DEFAULT 8,
    "skipFirstNActions" INTEGER NOT NULL DEFAULT 2,
    "adUnitKey" TEXT NOT NULL,
    "titleKey" TEXT,
    "descriptionKey" TEXT,
    "ctaLabelKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "AdPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRewardRule" (
    "id" SERIAL NOT NULL,
    "adType" TEXT NOT NULL,
    "coinsAwarded" INTEGER NOT NULL DEFAULT 50,
    "dailyCapForType" INTEGER NOT NULL DEFAULT 10,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 45,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresFullWatch" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "AdRewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCapPolicy" (
    "id" SERIAL NOT NULL,
    "tier" TEXT NOT NULL,
    "maxAdsPerDay" INTEGER NOT NULL DEFAULT 20,
    "maxCoinsPerDay" INTEGER NOT NULL DEFAULT 1000,
    "minCooldownSeconds" INTEGER NOT NULL DEFAULT 45,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCapPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentString" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "variant" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "ContentString_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenSection" (
    "id" SERIAL NOT NULL,
    "screen" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "layoutVariant" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "placementKey" TEXT NOT NULL,
    "adType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "errorCode" TEXT,
    "latencyMs" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouletteItem" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sizePortion" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "popupType" TEXT NOT NULL DEFAULT 'WINNING',
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouletteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouletteSpinHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "rouletteItemId" INTEGER NOT NULL,
    "coinsAwarded" INTEGER NOT NULL,
    "spinType" TEXT NOT NULL DEFAULT 'FREE',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouletteSpinHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyUserStats_date_idx" ON "DailyUserStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUserStats_userId_date_key" ON "DailyUserStats"("userId", "date");

-- CreateIndex
CREATE INDEX "UserActivityEvent_userId_createdAt_idx" ON "UserActivityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivityEvent_eventType_createdAt_idx" ON "UserActivityEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdPlacement_key_key" ON "AdPlacement"("key");

-- CreateIndex
CREATE INDEX "AdPlacement_screen_idx" ON "AdPlacement"("screen");

-- CreateIndex
CREATE UNIQUE INDEX "AdRewardRule_adType_key" ON "AdRewardRule"("adType");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCapPolicy_tier_key" ON "DailyCapPolicy"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "ContentString_key_key" ON "ContentString"("key");

-- CreateIndex
CREATE INDEX "ContentString_screen_idx" ON "ContentString"("screen");

-- CreateIndex
CREATE UNIQUE INDEX "ContentString_key_locale_variant_key" ON "ContentString"("key", "locale", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "ScreenSection_screen_idx" ON "ScreenSection"("screen");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenSection_screen_sectionKey_key" ON "ScreenSection"("screen", "sectionKey");

-- CreateIndex
CREATE INDEX "AdEvent_userId_timestamp_idx" ON "AdEvent"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AdEvent_placementKey_eventType_timestamp_idx" ON "AdEvent"("placementKey", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "AdEvent_adType_eventType_idx" ON "AdEvent"("adType", "eventType");

-- CreateIndex
CREATE INDEX "RouletteSpinHistory_userId_timestamp_idx" ON "RouletteSpinHistory"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "RouletteSpinHistory_rouletteItemId_timestamp_idx" ON "RouletteSpinHistory"("rouletteItemId", "timestamp");

-- AddForeignKey
ALTER TABLE "DailyUserStats" ADD CONSTRAINT "DailyUserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityEvent" ADD CONSTRAINT "UserActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouletteSpinHistory" ADD CONSTRAINT "RouletteSpinHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouletteSpinHistory" ADD CONSTRAINT "RouletteSpinHistory_rouletteItemId_fkey" FOREIGN KEY ("rouletteItemId") REFERENCES "RouletteItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
