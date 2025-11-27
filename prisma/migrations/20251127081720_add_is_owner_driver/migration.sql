/*
  Warnings:

  - You are about to drop the column `bankDetailsId` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "bankDetailsId",
ADD COLUMN     "isOwnerDriver" BOOLEAN NOT NULL DEFAULT false;
