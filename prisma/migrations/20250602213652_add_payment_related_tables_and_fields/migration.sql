/*
  Warnings:

  - You are about to drop the column `nightRate` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Car` table. All the data in the column will be lost.
  - Added the required column `dayPrice` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nightPrice` to the `Car` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutTransactionStatus" AS ENUM ('PENDING_APPROVAL', 'PENDING_DISBURSEMENT', 'PROCESSING', 'PAID_OUT', 'FAILED', 'REVERSED');

-- DropForeignKey
ALTER TABLE "DocumentApproval" DROP CONSTRAINT "DocumentApproval_carId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentApproval" DROP CONSTRAINT "DocumentApproval_userId_fkey";

-- DropForeignKey
ALTER TABLE "Extension" DROP CONSTRAINT "Extension_bookingLegId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_fleetOwnerId_fkey";

-- DropForeignKey
ALTER TABLE "VehicleImage" DROP CONSTRAINT "VehicleImage_carId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "fleetOwnerPayoutAmountNet" DECIMAL(10,2),
ADD COLUMN     "netTotal" DECIMAL(10,2),
ADD COLUMN     "overallPayoutStatus" "PayoutTransactionStatus",
ADD COLUMN     "platformCustomerServiceFeeAmount" DECIMAL(10,2),
ADD COLUMN     "platformCustomerServiceFeeRatePercent" DECIMAL(5,2),
ADD COLUMN     "platformFleetOwnerCommissionAmount" DECIMAL(10,2),
ADD COLUMN     "platformFleetOwnerCommissionRatePercent" DECIMAL(5,2),
ADD COLUMN     "subtotalBeforeVat" DECIMAL(10,2),
ADD COLUMN     "vatAmount" DECIMAL(10,2),
ADD COLUMN     "vatRatePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Car" DROP COLUMN "nightRate",
DROP COLUMN "price",
ADD COLUMN     "dayPrice" INTEGER NOT NULL,
ADD COLUMN     "nightPrice" INTEGER NOT NULL,
ALTER COLUMN "hourlyRate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Extension" ADD COLUMN     "fleetOwnerPayoutAmountNet" DECIMAL(10,2),
ADD COLUMN     "netTotal" DECIMAL(10,2),
ADD COLUMN     "overallPayoutStatus" "PayoutTransactionStatus",
ADD COLUMN     "platformCustomerServiceFeeAmount" DECIMAL(10,2),
ADD COLUMN     "platformCustomerServiceFeeRatePercent" DECIMAL(5,2),
ADD COLUMN     "platformFleetOwnerCommissionAmount" DECIMAL(10,2),
ADD COLUMN     "platformFleetOwnerCommissionRatePercent" DECIMAL(5,2),
ADD COLUMN     "subtotalBeforeVat" DECIMAL(10,2),
ADD COLUMN     "vatAmount" DECIMAL(10,2),
ADD COLUMN     "vatRatePercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "extensionId" TEXT,
    "txRef" TEXT NOT NULL,
    "flutterwaveTransactionId" TEXT,
    "flutterwaveReference" TEXT,
    "amountExpected" DECIMAL(10,2) NOT NULL,
    "amountCharged" DECIMAL(10,2),
    "currency" TEXT NOT NULL,
    "feeChargedByProvider" DECIMAL(10,2),
    "status" "PaymentAttemptStatus" NOT NULL,
    "paymentProviderStatus" TEXT,
    "paymentMethod" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "webhookPayload" JSONB,
    "verificationResponse" JSONB,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutTransaction" (
    "id" TEXT NOT NULL,
    "fleetOwnerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "extensionId" TEXT,
    "amountToPay" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2),
    "currency" TEXT NOT NULL,
    "status" "PayoutTransactionStatus" NOT NULL,
    "payoutProviderReference" TEXT,
    "payoutMethodDetails" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PayoutTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txRef_key" ON "Payment"("txRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_flutterwaveTransactionId_key" ON "Payment"("flutterwaveTransactionId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_extensionId_idx" ON "Payment"("extensionId");

-- CreateIndex
CREATE INDEX "Payment_txRef_idx" ON "Payment"("txRef");

-- CreateIndex
CREATE INDEX "Payment_flutterwaveTransactionId_idx" ON "Payment"("flutterwaveTransactionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "PayoutTransaction_fleetOwnerId_idx" ON "PayoutTransaction"("fleetOwnerId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_status_idx" ON "PayoutTransaction"("status");

-- CreateIndex
CREATE INDEX "PayoutTransaction_bookingId_idx" ON "PayoutTransaction"("bookingId");

-- CreateIndex
CREATE INDEX "PayoutTransaction_extensionId_idx" ON "PayoutTransaction"("extensionId");

-- CreateIndex
CREATE INDEX "Booking_overallPayoutStatus_idx" ON "Booking"("overallPayoutStatus");

-- CreateIndex
CREATE INDEX "Extension_overallPayoutStatus_idx" ON "Extension"("overallPayoutStatus");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_bookingLegId_fkey" FOREIGN KEY ("bookingLegId") REFERENCES "BookingLeg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_fleetOwnerId_fkey" FOREIGN KEY ("fleetOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutTransaction" ADD CONSTRAINT "PayoutTransaction_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImage" ADD CONSTRAINT "VehicleImage_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;
