import type { LoaderFunctionArgs } from "@remix-run/node";
import { formatDistanceToNow } from "date-fns";
import logger from "~/lib/logger.server";
import { isValidFlightNumberFormat, validateFlight } from "~/services/flight-validation.server";

type ValidationError = { error: string; status: number };

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
function errorResponse(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
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
): string | undefined {
  const arrivalTime = new Date(
    flight.actualArrival ?? flight.estimatedArrival ?? flight.scheduledArrival,
  );
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  if (arrivalTime < now) {
    logger.info(
      `[API /api/search-flight] Flight ${flightNumber} has already landed at ${arrivalTime.toISOString()}`,
    );
    return "This flight has already landed.";
  }

  if (arrivalTime < oneHourFromNow) {
    const timeUntilArrival = formatDistanceToNow(arrivalTime, { addSuffix: false });
    logger.info(
      `[API /api/search-flight] Flight ${flightNumber} arrives soon (in ${timeUntilArrival})`,
    );
    return `This flight arrives in ${timeUntilArrival}. We require at least 1 hour advance notice to arrange an airport pickup. For immediate pickup needs, please contact us directly.`;
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
    );
  }
  if (message.includes("rate limit")) {
    return errorResponse("Too many requests. Please try again in a few minutes.", 429);
  }
  return errorResponse(
    message || "An error occurred while searching for the flight. Please try again.",
    500,
  );
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
  const url = new URL(request.url);
  const flightNumber = url.searchParams.get("flightNumber");
  const pickupDate = url.searchParams.get("date");

  // Validate all parameters upfront
  const validationError = validateRequestParams(flightNumber, pickupDate);
  if (validationError) {
    return errorResponse(validationError.error, validationError.status);
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
              flight: null,
            },
            { status: 200, headers: NO_CACHE_HEADERS },
          );
        }

        logger.info(`[API /api/search-flight] Flight ${validFlightNumber} found successfully`);
        return Response.json(
          { success: true, flight, warning: getArrivalWarning(flight, validFlightNumber) },
          { status: 200, headers: NO_CACHE_HEADERS },
        );
      }

      case "alreadyLanded": {
        logger.info(`[API /api/search-flight] Flight ${result.flightNumber} already landed`);
        return Response.json(
          {
            success: true,
            message: `${result.flightNumber} already landed at ${result.landedTime}`,
            flight: null,
          },
          { status: 200, headers: NO_CACHE_HEADERS },
        );
      }

      case "notFound": {
        logger.info(
          `[API /api/search-flight] Flight ${validFlightNumber} not found for ${validPickupDate}`,
        );
        return Response.json(
          {
            success: false,
            error: `${validFlightNumber.toUpperCase()} not found. Verify the flight number and try again.`,
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
