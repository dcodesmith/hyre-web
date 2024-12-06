/*
  Warnings:

  - You are about to drop the `Mode` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `color` to the `Car` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "color" TEXT NOT NULL;

-- DropTable
DROP TABLE "Mode";
