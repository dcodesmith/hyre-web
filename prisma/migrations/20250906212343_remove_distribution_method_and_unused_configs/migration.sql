/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ReferralAttributionSource" AS ENUM ('LINK', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "public"."ReferralRewardStatus" AS ENUM ('PENDING', 'RELEASED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."ReferralReleaseCondition" AS ENUM ('PAID', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."BookingReferralStatus" AS ENUM ('NONE', 'APPLIED', 'REWARDED', 'REVERSED');

-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "referralDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "referralReferrerUserId" TEXT,
ADD COLUMN     "referralStatus" "public"."BookingReferralStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "referralAttributionSource" "public"."ReferralAttributionSource",
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralDiscountUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralSignupAt" TIMESTAMP(3),
ADD COLUMN     "referredByUserId" TEXT;

-- CreateTable
CREATE TABLE "public"."UserReferralStats" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "totalRewardsGranted" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalRewardsPending" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lastReferralAt" TIMESTAMP(3),

    CONSTRAINT "UserReferralStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralAttribution" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refereeUserId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "source" "public"."ReferralAttributionSource" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "securityFlags" JSONB,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralReward" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "refereeUserId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "public"."ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "releaseCondition" "public"."ReferralReleaseCondition" NOT NULL,
    "reason" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralProgramConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ReferralProgramConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserReferralStats_userId_key" ON "public"."UserReferralStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_refereeUserId_key" ON "public"."ReferralAttribution"("refereeUserId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referrerUserId_idx" ON "public"."ReferralAttribution"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralReward_referrerUserId_idx" ON "public"."ReferralReward"("referrerUserId");

-- CreateIndex
CREATE INDEX "ReferralReward_refereeUserId_idx" ON "public"."ReferralReward"("refereeUserId");

-- CreateIndex
CREATE INDEX "ReferralReward_bookingId_idx" ON "public"."ReferralReward"("bookingId");

-- CreateIndex
CREATE INDEX "ReferralReward_status_createdAt_idx" ON "public"."ReferralReward"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_referralStatus_idx" ON "public"."Booking"("referralStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "public"."User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "public"."User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredByUserId_idx" ON "public"."User"("referredByUserId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_referralReferrerUserId_fkey" FOREIGN KEY ("referralReferrerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserReferralStats" ADD CONSTRAINT "UserReferralStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_refereeUserId_fkey" FOREIGN KEY ("refereeUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_refereeUserId_fkey" FOREIGN KEY ("refereeUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralReward" ADD CONSTRAINT "ReferralReward_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
