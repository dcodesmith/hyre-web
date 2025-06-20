/*
  Warnings:

  - The values [CUSTOMER_SERVICE_FEE] on the enum `PlatformFeeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dayPrice` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `nightPrice` on the `Car` table. All the data in the column will be lost.
  - Added the required column `dayRate` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nightRate` to the `Car` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlatformFeeType_new" AS ENUM ('PLATFORM_SERVICE_FEE', 'FLEET_OWNER_COMMISSION');
ALTER TABLE "PlatformFeeRate" ALTER COLUMN "feeType" TYPE "PlatformFeeType_new" USING ("feeType"::text::"PlatformFeeType_new");
ALTER TYPE "PlatformFeeType" RENAME TO "PlatformFeeType_old";
ALTER TYPE "PlatformFeeType_new" RENAME TO "PlatformFeeType";
DROP TYPE "PlatformFeeType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Car" DROP COLUMN "dayPrice",
DROP COLUMN "nightPrice",
ADD COLUMN     "dayRate" INTEGER NOT NULL,
ADD COLUMN     "nightRate" INTEGER NOT NULL;
