-- CreateEnum
CREATE TYPE "BookingAcquisitionChannel" AS ENUM ('GLOBAL', 'PARTNER');

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN     "acquisitionChannel" "BookingAcquisitionChannel" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "acquisitionPartnerOwnerId" TEXT,
ADD COLUMN     "acquisitionPartnerSlug" TEXT;

-- CreateIndex
CREATE INDEX "Booking_acquisitionChannel_idx" ON "Booking"("acquisitionChannel");

-- CreateIndex
CREATE INDEX "Booking_acquisitionPartnerOwnerId_createdAt_idx" ON "Booking"("acquisitionPartnerOwnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_acquisitionPartnerOwnerId_fkey" FOREIGN KEY ("acquisitionPartnerOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
