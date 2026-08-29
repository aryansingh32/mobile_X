-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_userId_createdAt_idx" ON "ErrorLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_statusCode_idx" ON "ErrorLog"("statusCode");

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
