-- AlterEnum
ALTER TYPE "public"."BookingType" ADD VALUE 'FULL_DAY';

-- AlterTable
-- 1) Add column nullable
ALTER TABLE "public"."Car" ADD COLUMN "fullDayRate" INTEGER;

-- 2) Backfill existing rows (example: day + night; revise if your rule differs)
UPDATE "public"."Car"
SET "fullDayRate" = GREATEST(1, "dayRate" + "nightRate")
WHERE "fullDayRate" IS NULL;

-- 3) Enforce NOT NULL and positive values
ALTER TABLE "public"."Car" ALTER COLUMN "fullDayRate" SET NOT NULL;
ALTER TABLE "public"."Car" ADD CONSTRAINT car_fullDayRate_positive CHECK ("fullDayRate" > 0);
