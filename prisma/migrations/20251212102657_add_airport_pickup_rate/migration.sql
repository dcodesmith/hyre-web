/*
  Warnings:

  - Added the required column `airportPickupRate` to the `Car` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "BookingType" ADD VALUE IF NOT EXISTS 'AIRPORT_PICKUP';

-- AlterTable
-- Step 1: Add the column with a default value
ALTER TABLE "Car" ADD COLUMN "airportPickupRate" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Update existing rows to use dayRate as the airport pickup rate
UPDATE "Car" SET "airportPickupRate" = "dayRate" WHERE "airportPickupRate" = 0;

-- Step 3: Remove the default constraint (column remains NOT NULL but without default)
ALTER TABLE "Car" ALTER COLUMN "airportPickupRate" DROP DEFAULT;
