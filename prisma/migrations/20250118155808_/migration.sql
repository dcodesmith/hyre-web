/*
  Warnings:

  - You are about to drop the column `guestUser` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "guestUser",
ADD COLUMN     "guestInfo" JSONB;
