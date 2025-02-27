/*
  Warnings:

  - You are about to drop the column `guestInfo` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "guestInfo",
ADD COLUMN     "guestUser" JSONB;
