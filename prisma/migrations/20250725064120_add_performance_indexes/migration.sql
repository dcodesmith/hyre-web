-- CreateIndex
CREATE INDEX "Booking_startDate_endDate_status_idx" ON "Booking"("startDate", "endDate", "status");

-- CreateIndex
CREATE INDEX "Booking_chauffeurId_status_startDate_endDate_idx" ON "Booking"("chauffeurId", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_carId_paymentStatus_status_startDate_endDate_idx" ON "Booking"("carId", "paymentStatus", "status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_type_endDate_idx" ON "Booking"("type", "endDate");

-- CreateIndex
CREATE INDEX "Car_ownerId_approvalStatus_idx" ON "Car"("ownerId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Car_approvalStatus_idx" ON "Car"("approvalStatus");

-- CreateIndex
CREATE INDEX "Car_status_idx" ON "Car"("status");

-- CreateIndex
CREATE INDEX "Car_updatedAt_dayRate_idx" ON "Car"("updatedAt" DESC, "dayRate" ASC);

-- CreateIndex
CREATE INDEX "User_fleetOwnerId_idx" ON "User"("fleetOwnerId");

-- CreateIndex
CREATE INDEX "User_fleetOwnerStatus_hasOnboarded_idx" ON "User"("fleetOwnerStatus", "hasOnboarded");

-- CreateIndex
CREATE INDEX "User_hasOnboarded_idx" ON "User"("hasOnboarded");

-- CreateIndex
CREATE INDEX "User_id_email_idx" ON "User"("id", "email");
