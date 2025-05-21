import { subHours } from "date-fns";
import { cleanupPendingBookings } from "~/services/bookings.server";
import logger from "~/lib/logger.server";

/**
 * Job to clean up abandoned pending bookings
 * This should be run periodically (e.g., every hour) to prevent lingering pending bookings
 */
export async function cleanAbandonedBookings() {
  try {
    // Clean up bookings older than 1 hour
    const cutoffTime = subHours(new Date(), 1);
    const result = await cleanupPendingBookings(cutoffTime);

    logger.info(`Cleaned up ${result.count} abandoned pending bookings`);
    return result;
  } catch (error: unknown) {
    logger.error(
      `Failed to clean up abandoned bookings: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
