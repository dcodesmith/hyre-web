-- Drop existing foreign key constraint
ALTER TABLE "Extension" DROP CONSTRAINT "Extension_bookingId_fkey";

-- Drop existing unique constraint
-- ALTER TABLE "Extension" DROP CONSTRAINT "Extension_bookingId_key";

-- Add day column
ALTER TABLE "Extension" ADD COLUMN "day" TIMESTAMP(3) NOT NULL;

-- Create new indexes
CREATE INDEX "Extension_day_idx" ON "Extension"("day");
CREATE UNIQUE INDEX "Extension_bookingId_day_key" ON "Extension"("bookingId", "day");

-- Re-add foreign key constraint
-- ALTER TABLE "Extension" ADD CONSTRAINT "Extension_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 