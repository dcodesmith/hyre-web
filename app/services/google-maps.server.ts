import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";

const GOOGLE_ROUTES_API_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const DEFAULT_FALLBACK_DURATION_MINUTES = 180; // 3 hours fallback
const MURTALA_MUHAMMED_AIRPORT = "Murtala Muhammed International Airport, Lagos, Nigeria";

export interface DistanceMatrixResult {
  durationInMinutes: number;
  durationText: string;
  distanceInMeters: number;
  distanceText: string;
  status: "success" | "fallback";
}

/**
 * Format duration in minutes to human-readable text
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mins`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMinutes} mins`;
}

/**
 * Calculate drive time and distance from Lagos airport to a destination address
 * Uses Google Routes API v2 (modern, traffic-aware) with fallback to 3-hour default
 *
 * @param destinationAddress - The drop-off address
 * @param arrivalTime - Optional flight arrival time (for future enhancements)
 * @returns Distance and duration information
 */
export async function calculateAirportTripDuration(
  destinationAddress: string,
  _arrivalTime?: Date,
): Promise<DistanceMatrixResult> {
  try {
    const body = {
      origins: [{ waypoint: { address: MURTALA_MUHAMMED_AIRPORT } }],
      destinations: [{ waypoint: { address: destinationAddress } }],
      travelMode: "DRIVE",
      // TRAFFIC_AWARE provides live traffic conditions (similar to departure_time=now)
      routingPreference: "TRAFFIC_AWARE",
    };

    logger.info(
      `[Google Routes API v2] Requesting distance matrix from airport to ${destinationAddress}`,
    );

    const response = await fetch(GOOGLE_ROUTES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_DISTANCE_MATRIX_API_KEY,
        // FieldMask is REQUIRED in v2 - specify all fields you want returned
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition,status",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Google Routes API v2] HTTP error: ${response.status} ${response.statusText}`);
      logger.error(`[Google Routes API v2] Error response: ${errorText}`);

      // Check for common errors
      if (response.status === 403) {
        logger.error("[Google Routes API v2] 403 FORBIDDEN - This usually means:");
        logger.error("  1. Routes API is not enabled in Google Cloud Console");
        logger.error("  2. API key doesn't have permission for Routes API");
        logger.error("  3. Billing is not enabled for the project");
      }

      return getFallbackDuration();
    }

    const data = await response.json();

    // Check if we have valid data array
    if (!Array.isArray(data) || data.length === 0) {
      logger.error("[Google Routes API v2] Invalid response structure - expected array");
      logger.error("[Google Routes API v2] Response:", JSON.stringify(data, null, 2));
      return getFallbackDuration();
    }

    const element = data[0];

    // Extract duration and distance from v2 response
    // Duration comes as "3600s" format, distance as number
    const durationString = element.duration; // e.g., "3600s"
    const distanceInMeters = element.distanceMeters;

    if (!durationString || !distanceInMeters) {
      logger.error("[Google Routes API v2] Missing duration or distance data");
      logger.error("[Google Routes API v2] Element:", JSON.stringify(element, null, 2));
      return getFallbackDuration();
    }

    // Parse duration from "3600s" format to seconds
    const durationInSeconds = Number.parseInt(durationString.replace("s", ""), 10);

    if (Number.isNaN(durationInSeconds)) {
      logger.error(`[Google Routes API v2] Invalid duration format: ${durationString}`);
      return getFallbackDuration();
    }

    const durationInMinutes = Math.ceil(durationInSeconds / 60);

    // Format duration text (e.g., "45 mins" or "1 hour 30 mins")
    const durationText = formatDuration(durationInMinutes);

    // Format distance text (e.g., "12.3 km")
    const distanceText = `${(distanceInMeters / 1000).toFixed(1)} km`;

    logger.info(
      `[Google Routes API v2] Success: ${durationText} (${durationInMinutes} min), ${distanceText} from airport to destination`,
    );

    // Log traffic condition if available
    if (element.condition) {
      logger.info(`[Google Routes API v2] Traffic condition: ${element.condition}`);
    }

    return {
      durationInMinutes,
      durationText,
      distanceInMeters,
      distanceText,
      status: "success",
    };
  } catch (error) {
    logger.error(
      `[Google Routes API v2] Exception: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    if (error instanceof Error && error.stack) {
      logger.error(`[Google Routes API v2] Stack trace: ${error.stack}`);
    }
    return getFallbackDuration();
  }
}

/**
 * Returns the fallback duration when Google Routes API fails
 */
function getFallbackDuration(): DistanceMatrixResult {
  logger.info(
    `[Google Routes API v2] Using fallback duration: ${DEFAULT_FALLBACK_DURATION_MINUTES} minutes`,
  );
  return {
    durationInMinutes: DEFAULT_FALLBACK_DURATION_MINUTES,
    durationText: `${formatDuration(DEFAULT_FALLBACK_DURATION_MINUTES)} (estimated)`,
    distanceInMeters: 0,
    distanceText: "Distance unavailable",
    status: "fallback",
  };
}
