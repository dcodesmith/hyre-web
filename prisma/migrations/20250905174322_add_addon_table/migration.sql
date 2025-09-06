-- CreateEnum
CREATE TYPE "public"."AddonType" AS ENUM ('SECURITY_DETAIL');

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_fleetOwnerId_fkey";

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "securityDetailCost" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "public"."AddonRate" (
    "id" TEXT NOT NULL,
    "addonType" "public"."AddonType" NOT NULL,
    "rateAmount" DECIMAL(10,2) NOT NULL,
    "effectiveSince" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddonRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AddonRate_addonType_effectiveSince_effectiveUntil_idx" ON "public"."AddonRate"("addonType", "effectiveSince", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AddonRate_addonType_effectiveSince_key" ON "public"."AddonRate"("addonType", "effectiveSince");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "public"."User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
