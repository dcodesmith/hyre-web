-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'SUV', 'LUXURY_SEDAN', 'LUXURY_SUV', 'VAN', 'CROSSOVER');

-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('STANDARD', 'EXECUTIVE', 'LUXURY', 'ULTRA_LUXURY');

-- AlterTable
ALTER TABLE "Car" ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'SEDAN';
ALTER TABLE "Car" ADD COLUMN "serviceTier" "ServiceTier" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Car" ADD COLUMN "passengerCapacity" INTEGER NOT NULL DEFAULT 4;

-- CreateIndex
CREATE INDEX "Car_vehicleType_idx" ON "Car"("vehicleType");

-- CreateIndex
CREATE INDEX "Car_serviceTier_idx" ON "Car"("serviceTier");

-- CreateIndex
CREATE INDEX "Car_serviceTier_vehicleType_idx" ON "Car"("serviceTier", "vehicleType");

