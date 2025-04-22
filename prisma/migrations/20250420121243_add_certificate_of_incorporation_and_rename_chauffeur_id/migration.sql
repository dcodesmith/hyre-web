/*
  Warnings:

  - You are about to drop the column `chauffeurId` on the `DocumentApproval` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[documentType,userId]` on the table `DocumentApproval` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'CERTIFICATE_OF_INCORPORATION';

-- DropForeignKey
ALTER TABLE "DocumentApproval" DROP CONSTRAINT "DocumentApproval_chauffeurId_fkey";

-- DropIndex
DROP INDEX "DocumentApproval_documentType_chauffeurId_key";

-- AlterTable
ALTER TABLE "DocumentApproval" DROP COLUMN "chauffeurId",
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentApproval_documentType_userId_key" ON "DocumentApproval"("documentType", "userId");

-- AddForeignKey
ALTER TABLE "DocumentApproval" ADD CONSTRAINT "DocumentApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
