-- CreateIndex
CREATE INDEX "Booking_referralStatus_status_idx" ON "Booking"("referralStatus", "status");

-- CreateIndex
CREATE INDEX "Booking_userId_paymentStatus_referralCreditsUsed_idx" ON "Booking"("userId", "paymentStatus", "referralCreditsUsed");

-- CreateIndex
CREATE INDEX "Booking_userId_paymentStatus_referralCreditsReserved_idx" ON "Booking"("userId", "paymentStatus", "referralCreditsReserved");

-- CreateIndex
CREATE INDEX "ReferralReward_status_bookingId_idx" ON "ReferralReward"("status", "bookingId");

-- CreateIndex
CREATE INDEX "ReferralReward_status_processedAt_idx" ON "ReferralReward"("status", "processedAt");
