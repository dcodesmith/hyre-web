-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentIntent" TEXT;

-- CreateIndex
CREATE INDEX "Booking_paymentIntent_idx" ON "Booking"("paymentIntent");
