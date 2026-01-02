-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "carRating" INTEGER NOT NULL,
    "chauffeurRating" INTEGER NOT NULL,
    "serviceRating" INTEGER NOT NULL,
    "comment" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "moderatedAt" TIMESTAMP(3),
    "moderatedBy" TEXT,
    "moderationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_overallRating_idx" ON "Review"("overallRating");

-- CreateIndex
CREATE INDEX "Review_carRating_idx" ON "Review"("carRating");

-- CreateIndex
CREATE INDEX "Review_chauffeurRating_idx" ON "Review"("chauffeurRating");

-- CreateIndex
CREATE INDEX "Review_serviceRating_idx" ON "Review"("serviceRating");

-- CreateIndex
CREATE INDEX "Review_isVisible_idx" ON "Review"("isVisible");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Review_moderatedBy_idx" ON "Review"("moderatedBy");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedBy_fkey" FOREIGN KEY ("moderatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add check constraints for ratings
ALTER TABLE "Review" ADD CONSTRAINT "Review_overallRating_check" CHECK ("overallRating" >= 1 AND "overallRating" <= 5);

ALTER TABLE "Review" ADD CONSTRAINT "Review_carRating_check" CHECK ("carRating" >= 1 AND "carRating" <= 5);

ALTER TABLE "Review" ADD CONSTRAINT "Review_chauffeurRating_check" CHECK ("chauffeurRating" >= 1 AND "chauffeurRating" <= 5);

ALTER TABLE "Review" ADD CONSTRAINT "Review_serviceRating_check" CHECK ("serviceRating" >= 1 AND "serviceRating" <= 5);

ALTER TABLE "Review" ADD CONSTRAINT "Review_comment_length_check" CHECK (comment IS NULL OR LENGTH(comment) <= 2000);