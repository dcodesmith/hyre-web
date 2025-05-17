-- Add nightRate column with default value
ALTER TABLE "Car" ADD COLUMN IF NOT EXISTS "nightRate" INTEGER NOT NULL DEFAULT 100000;

-- Update any existing NULL values to the default
UPDATE "Car" SET "nightRate" = 100000 WHERE "nightRate" IS NULL; 