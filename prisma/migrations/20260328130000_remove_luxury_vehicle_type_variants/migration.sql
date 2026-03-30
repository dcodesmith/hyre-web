-- Collapse LUXURY_SEDAN / LUXURY_SUV into SEDAN / SUV.
-- The luxury distinction is already captured by the ServiceTier column,
-- so these composite vehicle types are redundant.

-- Step 1: Remap existing rows before altering the enum
UPDATE "Car" SET "vehicleType" = 'SEDAN'  WHERE "vehicleType" = 'LUXURY_SEDAN';
UPDATE "Car" SET "vehicleType" = 'SUV'    WHERE "vehicleType" = 'LUXURY_SUV';

-- Step 2: Remove the deprecated enum values
-- PostgreSQL requires creating a new enum type and swapping it in.
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";

CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'SUV', 'VAN', 'CROSSOVER');

ALTER TABLE "Car"
  ALTER COLUMN "vehicleType" DROP DEFAULT,
  ALTER COLUMN "vehicleType" TYPE "VehicleType" USING ("vehicleType"::text::"VehicleType"),
  ALTER COLUMN "vehicleType" SET DEFAULT 'SEDAN';

DROP TYPE "VehicleType_old";
