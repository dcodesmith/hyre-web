/*
  Warnings:

  - You are about to drop the column `images` on the `Car` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'FLEET_OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChauffeurApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NIN', 'DRIVERS_LICENSE', 'MOT_CERTIFICATE', 'INSURANCE_CERTIFICATE');

-- AlterTable
ALTER TABLE "Car" DROP COLUMN "images",
ADD COLUMN     "imagesUrl" TEXT[],
ADD COLUMN     "insuranceCertificateUrl" TEXT,
ADD COLUMN     "motCertificateUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chauffeurApprovalStatus" "ChauffeurApprovalStatus" DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "DocumentApproval" (
    "id" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "documentUrl" TEXT NOT NULL,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "chauffeurId" TEXT,
    "carId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentApproval_status_idx" ON "DocumentApproval"("status");

-- CreateIndex
CREATE INDEX "DocumentApproval_documentType_idx" ON "DocumentApproval"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_documentType_chauffeurId_key" ON "DocumentApproval"("documentType", "chauffeurId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_documentType_carId_key" ON "DocumentApproval"("documentType", "carId");

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
