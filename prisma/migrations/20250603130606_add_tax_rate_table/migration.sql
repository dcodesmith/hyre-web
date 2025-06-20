-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "effectiveSince" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "description" TEXT DEFAULT 'Nigerian VAT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRate_effectiveSince_effectiveUntil_idx" ON "TaxRate"("effectiveSince", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_effectiveSince_key" ON "TaxRate"("effectiveSince");
