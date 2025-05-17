/*
  Warnings:

  - You are about to drop the column `status` on the `Extension` table. All the data in the column will be lost.
  - Added the required column `originalEndDate` to the `Extension` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Extension" DROP COLUMN "status",
ADD COLUMN     "originalEndDate" TIMESTAMP(3) NOT NULL;
