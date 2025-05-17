/*
  Warnings:

  - You are about to drop the column `paidAt` on the `Extension` table. All the data in the column will be lost.
  - Added the required column `hours` to the `Extension` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Extension_bookingId_key";

-- AlterTable
ALTER TABLE "Extension" DROP COLUMN "paidAt",
ADD COLUMN     "hours" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Extension" ADD CONSTRAINT "Extension_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
