-- AlterTable
ALTER TABLE "Extension" ADD COLUMN     "paymentIntent" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Extension_status_idx" ON "Extension"("status");
