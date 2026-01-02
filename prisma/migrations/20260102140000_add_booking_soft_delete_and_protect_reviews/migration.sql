-- Add soft-delete field to Booking table
ALTER TABLE "Booking" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create index on deletedAt for efficient querying of non-deleted bookings
CREATE INDEX "Booking_deletedAt_idx" ON "Booking"("deletedAt");

-- Drop the existing foreign key constraint with CASCADE
ALTER TABLE "Review" DROP CONSTRAINT "Review_bookingId_fkey";

-- Recreate the foreign key constraint with RESTRICT to prevent accidental deletion
-- This ensures reviews persist independently of booking lifecycle for analytics/reputation
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- Drop the existing foreign key constraint for userId with RESTRICT
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- Recreate the foreign key constraint with CASCADE to allow user deletion
-- When a user is deleted, their reviews are also deleted
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

