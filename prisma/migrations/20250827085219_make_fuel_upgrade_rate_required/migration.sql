/*
  Warnings:

  - Made the column `fuelUpgradeRate` on table `Car` required. This step will fail if there are existing NULL values in that column.

*/

-- First, set a default fuel upgrade rate for existing cars with NULL values
-- Using 20000 (₦200) as a reasonable default for fuel upgrade cost
UPDATE "public"."Car" SET "fuelUpgradeRate" = 20000 WHERE "fuelUpgradeRate" IS NULL;

-- AlterTable
ALTER TABLE "public"."Car" ALTER COLUMN "fuelUpgradeRate" SET NOT NULL;
