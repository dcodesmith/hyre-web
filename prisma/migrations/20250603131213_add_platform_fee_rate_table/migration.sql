-- CreateEnum
CREATE TYPE "PlatformFeeType" AS ENUM ('CUSTOMER_SERVICE_FEE', 'FLEET_OWNER_COMMISSION');

-- CreateTable
CREATE TABLE "PlatformFeeRate" (
    "id" TEXT NOT NULL,
    "feeType" "PlatformFeeType" NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "effectiveSince" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformFeeRate_feeType_effectiveSince_effectiveUntil_idx" ON "PlatformFeeRate"("feeType", "effectiveSince", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeeRate_feeType_effectiveSince_key" ON "PlatformFeeRate"("feeType", "effectiveSince");
