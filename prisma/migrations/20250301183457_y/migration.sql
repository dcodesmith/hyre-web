-- CreateEnum
CREATE TYPE "CarApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FleetOwnerStatus" AS ENUM ('PROCESSING', 'APPROVED', 'ON_HOLD', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "approvalStatus" "CarApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fleetOwnerStatus" "FleetOwnerStatus" DEFAULT 'PROCESSING';
