-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('DAY', 'NIGHT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "type" "BookingType" NOT NULL DEFAULT 'DAY';

-- AlterTable
ALTER TABLE "Car" ALTER COLUMN "nightRate" DROP DEFAULT;
