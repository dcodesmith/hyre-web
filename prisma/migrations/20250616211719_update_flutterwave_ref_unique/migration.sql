/*
  Warnings:

  - A unique constraint covering the columns `[flutterwaveReference]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Payment_flutterwaveReference_key" ON "Payment"("flutterwaveReference");
