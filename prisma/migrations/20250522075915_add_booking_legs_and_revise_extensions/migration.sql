/*
  Warnings:

  - You are about to drop the column `bookingId` on the `Extension` table. All the data in the column will be lost.
  - You are about to drop the column `day` on the `Extension` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Extension` table. All the data in the column will be lost.
  - You are about to drop the column `hours` on the `Extension` table. All the data in the column will be lost.
  - You are about to drop the column `originalEndDate` on the `Extension` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Extension` table. All the data in the column will be lost.
  - Added the required column `bookingLegId` to the `Extension` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventType` to the `Extension` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extendedDurationHours` to the `Extension` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extensionEndTime` to the `Extension` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extensionStartTime` to the `Extension` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExtensionEventType" AS ENUM ('HOURLY_MODIFICATION', 'NEW_DAY_ADDITION');

-- DropForeignKey
ALTER TABLE "Extension" DROP CONSTRAINT "Extension_bookingId_fkey";

-- DropIndex
DROP INDEX "Extension_bookingId_day_key";

-- DropIndex
DROP INDEX "Extension_bookingId_idx";

-- DropIndex
DROP INDEX "Extension_day_idx";

-- AlterTable
ALTER TABLE "Extension" DROP COLUMN "bookingId",
DROP COLUMN "day",
DROP COLUMN "endDate",
DROP COLUMN "hours",
DROP COLUMN "originalEndDate",
DROP COLUMN "startDate",
ADD COLUMN     "bookingLegId" TEXT NOT NULL,
ADD COLUMN     "eventType" "ExtensionEventType" NOT NULL,
ADD COLUMN     "extendedDurationHours" INTEGER NOT NULL,
ADD COLUMN     "extensionEndTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "extensionStartTime" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "BookingLeg" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "legDate" DATE NOT NULL,
    "totalDailyPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingLeg_bookingId_idx" ON "BookingLeg"("bookingId");

-- CreateIndex
CREATE INDEX "BookingLeg_legDate_idx" ON "BookingLeg"("legDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookingLeg_bookingId_legDate_key" ON "BookingLeg"("bookingId", "legDate");

-- CreateIndex
CREATE INDEX "Extension_bookingLegId_idx" ON "Extension"("bookingLegId");

-- CreateIndex
CREATE INDEX "Extension_eventType_idx" ON "Extension"("eventType");

-- AddForeignKey
ALTER TABLE "BookingLeg" ADD CONSTRAINT "BookingLeg_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_bookingLegId_fkey" FOREIGN KEY ("bookingLegId") REFERENCES "BookingLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
