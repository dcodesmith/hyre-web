-- Add cover-image flag to VehicleImage
ALTER TABLE "VehicleImage" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "VehicleImage_carId_isPrimary_idx" ON "VehicleImage"("carId", "isPrimary");

CREATE UNIQUE INDEX IF NOT EXISTS "VehicleImage_one_primary_per_car_idx"
  ON "VehicleImage"("carId")
  WHERE "isPrimary" = true;
