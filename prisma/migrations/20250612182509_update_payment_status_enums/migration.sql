-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'REFUND_PROCESSING';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'REFUND_FAILED';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_FAILED';
