-- AlterEnum: Update FlightStatus enum values
-- This migration updates the enum to align with FlightAware API statuses
-- Changes:
--   IN_AIR -> EN_ROUTE
--   ARRIVED -> LANDED
--   DELAYED -> (removed, use SCHEDULED + delayMinutes field)
--   + UNKNOWN (new)

-- Step 1: Create new enum type with updated values
CREATE TYPE "FlightStatus_new" AS ENUM ('SCHEDULED', 'DEPARTED', 'EN_ROUTE', 'LANDED', 'CANCELLED', 'DIVERTED', 'UNKNOWN');

-- Step 2: Drop default values on all columns using FlightStatus
ALTER TABLE "Flight" ALTER COLUMN "status" DROP DEFAULT;

-- Step 3: Update Flight table to use the new enum
ALTER TABLE "Flight" ALTER COLUMN "status" TYPE "FlightStatus_new" 
  USING (
    CASE "status"::text
      WHEN 'IN_AIR' THEN 'EN_ROUTE'
      WHEN 'ARRIVED' THEN 'LANDED'
      WHEN 'DELAYED' THEN 'SCHEDULED'
      ELSE "status"::text
    END
  )::"FlightStatus_new";

-- Step 4: Update FlightStatusEvent table oldStatus column
ALTER TABLE "FlightStatusEvent" ALTER COLUMN "oldStatus" TYPE "FlightStatus_new" 
  USING (
    CASE "oldStatus"::text
      WHEN 'IN_AIR' THEN 'EN_ROUTE'
      WHEN 'ARRIVED' THEN 'LANDED'
      WHEN 'DELAYED' THEN 'SCHEDULED'
      ELSE "oldStatus"::text
    END
  )::"FlightStatus_new";

-- Step 5: Update FlightStatusEvent table newStatus column
ALTER TABLE "FlightStatusEvent" ALTER COLUMN "newStatus" TYPE "FlightStatus_new" 
  USING (
    CASE "newStatus"::text
      WHEN 'IN_AIR' THEN 'EN_ROUTE'
      WHEN 'ARRIVED' THEN 'LANDED'
      WHEN 'DELAYED' THEN 'SCHEDULED'
      ELSE "newStatus"::text
    END
  )::"FlightStatus_new";

-- Step 6: Drop the old enum type
DROP TYPE "FlightStatus";

-- Step 7: Rename the new enum type to the original name
ALTER TYPE "FlightStatus_new" RENAME TO "FlightStatus";

-- Step 8: Re-add the default value with the new enum type
ALTER TABLE "Flight" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"FlightStatus";
