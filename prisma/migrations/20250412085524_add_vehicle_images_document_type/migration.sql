/*
  Warnings:

  - You are about to drop the column `imagesUrl` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `insuranceCertificateUrl` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `motCertificateUrl` on the `Car` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'VEHICLE_IMAGES';

-- AlterTable
ALTER TABLE "Car" DROP COLUMN "imagesUrl",
DROP COLUMN "insuranceCertificateUrl",
DROP COLUMN "motCertificateUrl";
