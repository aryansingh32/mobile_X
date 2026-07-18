-- CreateTable
CREATE TABLE "CatalogCode" (
    "id" SERIAL NOT NULL,
    "catalogItemId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "note" TEXT,
    "withdrawalId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCode_catalogItemId_code_key" ON "CatalogCode"("catalogItemId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCode_withdrawalId_key" ON "CatalogCode"("withdrawalId");

-- CreateIndex
CREATE INDEX "CatalogCode_catalogItemId_status_idx" ON "CatalogCode"("catalogItemId", "status");

-- AddForeignKey
ALTER TABLE "CatalogCode" ADD CONSTRAINT "CatalogCode_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCode" ADD CONSTRAINT "CatalogCode_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
