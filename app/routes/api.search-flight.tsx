import type { LoaderFunctionArgs } from "@remix-run/node";
import { formatDistanceToNow } from "date-fns";
import logger from "~/lib/logger.server";
import { isValidFlightNumberFormat, validateFlight } from "~/services/flight-validation.server";
import { checkSearchFlightRateLimit } from "~/utils/server/rate-limit.server";

type ValidationError = { error: string; status: number };
type FlightSearchErrorType =
  | "non_lagos_destination"
  | "already_landed"
  | "not_found"
  | "invalid_format"
  | "past_date";

const PAST_DATE_TOKEN = "past";
const INVALID_FORMAT_TOKENS = ["invalid flight number format", "invalid date format"] as const;

/** Validate request parameters and return error if invalid */
function validateRequestParams(
  flightNumber: string | null,
  pickupDate: string | null,
): ValidationError | null {
  if (!flightNumber) {
    return { error: "Missing required parameter: flightNumber", status: 400 };
  }
  if (!pickupDate) {
    return { error: "Missing required parameter: date", status: 400 };
  }
  if (!isValidFlightNumberFormat(flightNumber)) {
    return {
      error: `Invalid flight number format: ${flightNumber}. Expected format: 2-3 alphanumeric airline code + 1-5 digits (e.g., BA74, AA123, P47579)`,
      status: 400,
    };
  }

  const dateObj = new Date(pickupDate);
  if (Number.isNaN(dateObj.getTime())) {
    return {
      error: `Invalid date format: ${pickupDate}. Expected ISO date string (e.g., 2025-12-25)`,
      status: 400,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pickupDateObj = new Date(pickupDate);
  pickupDateObj.setHours(0, 0, 0, 0);

  if (pickupDateObj < today) {
    return {
      error: "Cannot search for flights in the past. Please select a future date.",
      status: 400,
    };
  }

  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(today.getFullYear() + 1);
  if (dateObj > oneYearFromNow) {
    return { error: "Cannot search for flights more than 1 year in the future", status: 400 };
  }

  return null;
}

/** Build error response JSON */
function errorResponse(
  error: string,
  status: number,
  shortError?: string,
  errorType?: FlightSearchErrorType,
) {
  return Response.json(
    { success: false, error, shortError: shortError ?? error, errorType },
    { status },
  );
}

function classifyFlightSearchError(message: string): FlightSearchErrorType | undefined {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes(PAST_DATE_TOKEN)) {
    return "past_date";
  }
  if (INVALID_FORMAT_TOKENS.some((token) => lowerMessage.includes(token))) {
    return "invalid_format";
  }
  return undefined;
}

/** Standard no-cache headers for flight data */
const NO_CACHE_HEADERS = { "Cache-Control": "no-cache, no-store, must-revalidate" };

/** Get warning message based on flight arrival time */
function getArrivalWarning(
  flight: {
    actualArrival?: string | null;
    estimatedArrival?: string | null;
    scheduledArrival: string;
  },
  flightNumber: string,
): { warning: string; shortWarning: string } | undefined {
  const arrivalTime = new Date(
    flight.actualArrival ?? flight.estimatedArrival ?? flight.scheduledArrival,
  );
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  if (arrivalTime < now) {
    logger.info(
      `[API /api/search-flight] Flight ${flightNumber} has already landed at ${arrivalTime.toISOString()}`,
    );
    return { warning: "This flight has already landed.", shortWarning: "Already landed" };
  }

  if (arrivalTime < oneHourFromNow) {
    const timeUntilArrival = formatDistanceToNow(arrivalTime, { addSuffix: false });
    logger.info(
      `[API /api/search-flight] Flight ${flightNumber} arrives soon (in ${timeUntilArrival})`,
    );
    return {
      warning: `This flight arrives in ${timeUntilArrival}. We require at least 1 hour advance notice to arrange an airport pickup. For immediate pickup needs, please contact us directly.`,
      shortWarning: `Arrives in ${timeUntilArrival}`,
    };
  }

  return undefined;
}

/** Handle error result from flight validation */
function handleFlightError(message: string): Response {
  logger.error(`[API /api/search-flight] Error: ${message}`);

  if (message.includes("API key")) {
    return errorResponse(
      "Flight validation service is temporarily unavailable. Please try again later.",
      503,
      "Service unavailable",
    );
  }
  if (message.includes("rate limit")) {
    return errorResponse(
      "Too many requests. Please try again in a few minutes.",
      429,
      "Try again shortly",
    );
  }
  return errorResponse(
    message || "An error occurred while searching for the flight. Please try again.",
    500,
    "Something went wrong",
  );
}

function toIsoDateUtc(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid date supplied to toIsoDateUtc");
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function wrapValidateFlightWithTimeout(
  flightNumber: string,
  pickupDate: string,
  timeoutMs = 4500,
) {
  return await Promise.race([
    validateFlight(flightNumber, pickupDate),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

/**
 * If a flight is "not found" for a specific date, probe nearby dates to determine
 * whether it likely exists but does not arrive in Lagos.
 */
async function isLikelyNonLagosFlight(flightNumber: string, pickupDate: string): Promise<boolean> {
  const baseDate = new Date(`${pickupDate}T00:00:00.000Z`);
  const nearbyOffsets = [-1, 1];
  const probes = nearbyOffsets.map(async (offset) => {
    const nearbyDate = new Date(baseDate);
    nearbyDate.setUTCDate(nearbyDate.getUTCDate() + offset);
    const nearbyDateStr = toIsoDateUtc(nearbyDate);
    return {
      nearbyDateStr,
      result: await wrapValidateFlightWithTimeout(flightNumber, nearbyDateStr),
    };
  });

  const settledResults = await Promise.allSettled(probes);
  for (const settled of settledResults) {
    if (settled.status !== "fulfilled" || !settled.value.result) continue;
    const { nearbyDateStr, result } = settled.value;
    if (result.type === "success" && result.flight.destinationIATA !== "LOS") {
      logger.info(
        "[API /api/search-flight] Classified not-found flight as non-Lagos via nearby date",
        {
          flightNumber,
          pickupDate,
          nearbyDate: nearbyDateStr,
          destinationIATA: result.flight.destinationIATA,
        },
      );
      return true;
    }
  }

  return false;
}

/**
 * API Route: /api/search-flight
 *
 * Search and validate a flight number for a specific pickup date.
 * Results are cached for 24 hours to minimize API calls.
 *
 * Query Parameters:
 * - flightNumber (required): IATA flight number (e.g., "BA74", "AA123")
 * - date (required): ISO date string for pickup date (e.g., "2025-12-25")
 *
 * Example:
 * GET /api/search-flight?flightNumber=BA74&date=2025-12-25
 *
 * Response (Success):
 * {
 *   "success": true,
 *   "flight": {
 *     "flightNumber": "BA74",
 *     "flightId": "BAW74-1735123456-airline-123",
 *     "origin": "EGLL",
 *     "originIATA": "LHR",
 *     "destination": "KJFK",
 *     "destinationIATA": "JFK",
 *     "scheduledArrival": "2025-12-25T14:30:00Z",
 *     "estimatedArrival": "2025-12-25T14:45:00Z",
 *     "actualArrival": null,
 *     "status": "Scheduled",
 *     "aircraftType": "B77W",
 *     "delay": 15
 *   }
 * }
 *
 * Response (Not Found):
 * {
 *   "success": false,
 *   "error": "Flight not found for this date"
 * }
 *
 * Response (Error):
 * {
 *   "success": false,
 *   "error": "Invalid flight number format..."
 * }
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const rateLimit = await checkSearchFlightRateLimit(request);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        success: false,
        error: rateLimit.message,
      },
      {
        status: rateLimit.status ?? 429,
        headers: rateLimit.headers,
      },
    );
  }

  const url = new URL(request.url);
  const flightNumber = url.searchParams.get("flightNumber");
  const pickupDate = url.searchParams.get("date");

  // Validate all parameters upfront
  const validationError = validateRequestParams(flightNumber, pickupDate);
  if (validationError) {
    const errorType = classifyFlightSearchError(validationError.error);
    return errorResponse(validationError.error, validationError.status, undefined, errorType);
  }

  // After validation, we know these are non-null
  const validFlightNumber = flightNumber as string;
  const validPickupDate = pickupDate as string;

  try {
    logger.info(
      `[API /api/search-flight] Searching for flight ${validFlightNumber} on ${validPickupDate}`,
    );
    const result = await validateFlight(validFlightNumber, validPickupDate);

    // Handle different result types
    switch (result.type) {
      case "success": {
        const flight = result.flight;

        // Check if destination is Lagos (LOS)
        if (flight.destinationIATA !== "LOS") {
          logger.info(`[API /api/search-flight] Flight ${validFlightNumber} does not fly to Lagos`);
          const destinationName = flight.destinationIATA || flight.destination;
          const originName = flight.originIATA || flight.origin;
          return Response.json(
            {
              success: true,
              message: `Flight ${validFlightNumber.toUpperCase()} flies from ${originName} to ${destinationName}. We only provide airport pickup for flights arriving in Lagos (LOS).`,
              shortMessage: "Flight doesn't arrive in Lagos",
              errorType: "non_lagos_destination",
              flight: null,
            },
            { status: 200, headers: NO_CACHE_HEADERS },
          );
        }

        logger.info(`[API /api/search-flight] Flight ${validFlightNumber} found successfully`);
        const arrivalWarning = getArrivalWarning(flight, validFlightNumber);
        return Response.json(
          {
            success: true,
            flight,
            warning: arrivalWarning?.warning,
            shortWarning: arrivalWarning?.shortWarning,
          },
          { status: 200, headers: NO_CACHE_HEADERS },
        );
      }

      case "alreadyLanded": {
        logger.info(`[API /api/search-flight] Flight ${result.flightNumber} already landed`);
        return Response.json(
          {
            success: true,
            message: `${result.flightNumber} already landed at ${result.landedTime}`,
            shortMessage: `Landed at ${result.landedTime}`,
            errorType: "already_landed",
            flight: null,
          },
          { status: 200, headers: NO_CACHE_HEADERS },
        );
      }

      case "notFound": {
        logger.info(
          `[API /api/search-flight] Flight ${validFlightNumber} not found for ${validPickupDate}`,
        );

        if (await isLikelyNonLagosFlight(validFlightNumber, validPickupDate)) {
          return Response.json(
            {
              success: true,
              message: "Flight doesn't go to Lagos.",
              shortMessage: "Flight doesn't go to Lagos.",
              errorType: "non_lagos_destination",
              flight: null,
            },
            { status: 200, headers: NO_CACHE_HEADERS },
          );
        }

        return Response.json(
          {
            success: false,
            error: `${validFlightNumber.toUpperCase()} not found. Verify the flight number and try again.`,
            shortError: "Flight not found",
            errorType: "not_found",
          },
          { status: 404, headers: NO_CACHE_HEADERS },
        );
      }

      case "error":
        return handleFlightError(result.message);
    }
  } catch (error) {
    // 10. Handle unexpected errors (shouldn't happen with new result type, but keep for safety)
    logger.error("[API /api/search-flight] Unexpected error:", error);
    logger.error("[API /api/search-flight] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Response.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 },
    );
  }
};
