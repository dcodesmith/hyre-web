-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "pricingIncludesFuel" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Car" ALTER COLUMN "fuelUpgradeRate" DROP NOT NULL;

