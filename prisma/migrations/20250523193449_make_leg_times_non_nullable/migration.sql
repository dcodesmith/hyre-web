/*
  Warnings:

  - The values [HOURLY_MODIFICATION] on the enum `ExtensionEventType` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `legEndTime` on table `BookingLeg` required. This step will fail if there are existing NULL values in that column.
  - Made the column `legStartTime` on table `BookingLeg` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ExtensionEventType_new" AS ENUM ('HOURLY_ADDITION', 'NEW_DAY_ADDITION');
ALTER TABLE "Extension" ALTER COLUMN "eventType" TYPE "ExtensionEventType_new" USING ("eventType"::text::"ExtensionEventType_new");
ALTER TYPE "ExtensionEventType" RENAME TO "ExtensionEventType_old";
ALTER TYPE "ExtensionEventType_new" RENAME TO "ExtensionEventType";
DROP TYPE "ExtensionEventType_old";
COMMIT;

-- AlterTable
ALTER TABLE "BookingLeg" ALTER COLUMN "legEndTime" SET NOT NULL,
ALTER COLUMN "legStartTime" SET NOT NULL;
