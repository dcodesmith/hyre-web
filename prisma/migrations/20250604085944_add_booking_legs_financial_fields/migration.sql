/*
  Warnings:

  - Added the required column `fleetOwnerEarningForLeg` to the `BookingLeg` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemsNetValueForLeg` to the `BookingLeg` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BookingLeg"
ADD COLUMN     "fleetOwnerEarningForLeg" DECIMAL(10,2),
ADD COLUMN     "itemsNetValueForLeg" DECIMAL(10,2),
ADD COLUMN     "platformCommissionAmountOnLeg" DECIMAL(10,2),
ADD COLUMN     "platformCommissionRateOnLeg" DECIMAL(5,2);
