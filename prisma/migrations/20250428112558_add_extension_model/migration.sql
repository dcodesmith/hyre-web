-- CreateTable
CREATE TABLE "Extension" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentId" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Extension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Extension_bookingId_key" ON "Extension"("bookingId");

-- CreateIndex
CREATE INDEX "Extension_paymentStatus_idx" ON "Extension"("paymentStatus");

-- CreateIndex
CREATE INDEX "Extension_bookingId_idx" ON "Extension"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");

-- AddForeignKey
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
