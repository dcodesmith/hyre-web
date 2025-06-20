/*
  Warnings:

  - Made the column `fleetOwnerEarningForLeg` on table `BookingLeg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `itemsNetValueForLeg` on table `BookingLeg` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "BookingLeg" ALTER COLUMN "fleetOwnerEarningForLeg" SET NOT NULL,
ALTER COLUMN "itemsNetValueForLeg" SET NOT NULL;
