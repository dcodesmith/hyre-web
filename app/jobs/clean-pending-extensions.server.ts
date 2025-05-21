import { subHours } from "date-fns";
import { cleanupPendingExtensions } from "~/services/extensions.server";
import logger from "~/lib/logger.server";

/**
 * Job to clean up abandoned pending extensions
 * This should be run periodically (e.g., every hour) to prevent lingering pending extensions
 */
export async function cleanAbandonedExtensions() {
  try {
    // Clean up extensions older than 1 hour
    const cutoffTime = subHours(new Date(), 1);
    const result = await cleanupPendingExtensions(cutoffTime);

    logger.info(`Cleaned up ${result.count} abandoned pending extensions`);
    return result;
  } catch (error: unknown) {
    logger.error(
      `Failed to clean up abandoned extensions: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
