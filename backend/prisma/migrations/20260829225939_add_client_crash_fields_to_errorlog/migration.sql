-- AlterTable
ALTER TABLE "ErrorLog" ADD COLUMN     "appVersion" TEXT,
ADD COLUMN     "fatal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'SERVER';

-- CreateIndex
CREATE INDEX "ErrorLog_source_createdAt_idx" ON "ErrorLog"("source", "createdAt");
