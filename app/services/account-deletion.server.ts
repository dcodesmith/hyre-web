import { prisma } from "~/modules/db/db.server";
import { deleteFileFromS3 } from "~/services/s3.server";
import logger from "~/lib/logger.server";

/**
 * Extract S3 key from a full S3 URL
 * e.g., "https://bucket.s3.region.amazonaws.com/documents/user123/nin.pdf" -> "documents/user123/nin.pdf"
 */
function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.slice(1);
  } catch {
    return null;
  }
}

/**
 * Delete a user's account and anonymize their data for NDPC compliance.
 *
 * This function:
 * 1. Anonymizes bookings (sets userId to null, clears guestUser)
 * 2. Deletes identity documents from S3
 * 3. Deletes the user record (cascades to sessions, bank details, documents)
 *
 * @param userId - The ID of the user to delete
 * @throws Error if user not found or deletion fails
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      documents: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  logger.info("Starting account deletion", { userId, email: user.email });

  // 1. Delete identity documents from S3 (best-effort, before transaction)
  const documentUrls = user.documents
    .map((doc) => doc.documentUrl)
    .filter((url): url is string => !!url);

  for (const url of documentUrls) {
    const s3Key = extractS3KeyFromUrl(url);
    if (s3Key) {
      try {
        await deleteFileFromS3(s3Key);
        logger.info("Deleted S3 document", { userId, s3Key });
      } catch (error) {
        // Log but don't fail - S3 deletion is best-effort
        logger.error("Failed to delete S3 document", { userId, s3Key, error });
      }
    }
  }

  // 2. Anonymize bookings and delete user in a transaction (atomic operation)
  const [anonymizedBookings] = await prisma.$transaction([
    // Anonymize bookings - remove link to user but keep financial records
    prisma.booking.updateMany({
      where: { userId },
      data: {
        userId: null,
        guestUser: null,
      },
    }),
    // Delete the user record (cascades to: sessions, bank details, documents)
    prisma.user.delete({
      where: { id: userId },
    }),
  ]);

  logger.info("Account deleted successfully", {
    userId,
    anonymizedBookingsCount: anonymizedBookings.count,
  });
}
