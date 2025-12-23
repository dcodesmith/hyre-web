import type { LoaderFunctionArgs } from "@remix-run/node";
import { formatDistanceToNow } from "date-fns";
import logger from "~/lib/logger.server";
import { isValidFlightNumberFormat, validateFlight } from "~/services/flight-validation.server";

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function handles multiple validation scenarios and error cases
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const flightNumber = url.searchParams.get("flightNumber");
  const pickupDate = url.searchParams.get("date");

  // 1. Validate required parameters
  if (!flightNumber) {
    return Response.json(
      {
        success: false,
        error: "Missing required parameter: flightNumber",
      },
      { status: 400 },
    );
  }

  if (!pickupDate) {
    return Response.json(
      {
        success: false,
        error: "Missing required parameter: date",
      },
      { status: 400 },
    );
  }

  // 2. Validate flight number format (quick client-side check)
  if (!isValidFlightNumberFormat(flightNumber)) {
    return Response.json(
      {
        success: false,
        error: `Invalid flight number format: ${flightNumber}. Expected format: 2-3 alphanumeric airline code + 1-5 digits (e.g., BA74, AA123, P47579)`,
      },
      { status: 400 },
    );
  }

  // 3. Validate date format
  const dateObj = new Date(pickupDate);
  if (Number.isNaN(dateObj.getTime())) {
    return Response.json(
      {
        success: false,
        error: `Invalid date format: ${pickupDate}. Expected ISO date string (e.g., 2025-12-25)`,
      },
      { status: 400 },
    );
  }

  // 4. Validate date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pickupDateObj = new Date(pickupDate);
  pickupDateObj.setHours(0, 0, 0, 0);

  if (pickupDateObj < today) {
    return Response.json(
      {
        success: false,
        error: "Cannot search for flights in the past. Please select a future date.",
      },
      { status: 400 },
    );
  }

  // 5. Validate date is not too far in the future (FlightAware typically has ~1 year of schedules)
  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(today.getFullYear() + 1);

  if (dateObj > oneYearFromNow) {
    return Response.json(
      {
        success: false,
        error: "Cannot search for flights more than 1 year in the future",
      },
      { status: 400 },
    );
  }

  try {
    // 6. Search for the flight (with caching)
    logger.info(`[API /api/search-flight] Searching for flight ${flightNumber} on ${pickupDate}`);
    const result = await validateFlight(flightNumber, pickupDate);

    // Handle different result types
    switch (result.type) {
      case "success": {
        const flight = result.flight;

        // 7. Check if destination is Lagos (LOS)
        if (flight.destinationIATA !== "LOS") {
          logger.info(
            `[API /api/search-flight] Flight ${flightNumber} does not fly to Lagos. Destination: ${flight.destinationIATA || flight.destination}`,
          );

          const destinationName = flight.destinationIATA || flight.destination;
          const originName = flight.originIATA || flight.origin;

          return Response.json(
            {
              success: true,
              message: `Flight ${flightNumber.toUpperCase()} flies from ${originName} to ${destinationName}. We only provide airport pickup for flights arriving in Lagos (LOS).`,
              flight: null,
            },
            {
              status: 200,
              headers: {
                // Don't cache informational messages
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            },
          );
        }

        // 8. Check timing and add appropriate messages
        const arrivalTime = new Date(
          flight.actualArrival || flight.estimatedArrival || flight.scheduledArrival,
        );
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        let warningMessage: string | undefined;

        // Check if flight has already landed (informational, not an error)
        if (arrivalTime < now) {
          logger.info(
            `[API /api/search-flight] Flight ${flightNumber} has already landed at ${arrivalTime.toISOString()}`,
          );
          warningMessage = "This flight has already landed.";
        }
        // Check if flight arrives within 1 hour (warning about insufficient notice)
        else if (arrivalTime < oneHourFromNow) {
          const timeUntilArrival = formatDistanceToNow(arrivalTime, { addSuffix: false });
          logger.info(
            `[API /api/search-flight] Flight ${flightNumber} arrives soon (in ${timeUntilArrival})`,
          );
          warningMessage = `This flight arrives in ${timeUntilArrival}. We require at least 1 hour advance notice to arrange an airport pickup. For immediate pickup needs, please contact us directly.`;
        }

        // 9. Return successful result (with optional warning message)
        logger.info(`[API /api/search-flight] Flight ${flightNumber} found successfully`);
        return Response.json(
          {
            success: true,
            flight,
            warning: warningMessage,
          },
          {
            status: 200,
            headers: {
              // Don't cache - flight status changes frequently (delays, cancellations, etc.)
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          },
        );
      }

      case "alreadyLanded": {
        // This is informational, not an error - the flight exists but has already landed
        const message = result.nextFlightDate
          ? `Flight ${result.flightNumber} has already landed at ${result.landedTime}. The next ${result.flightNumber} flight arrives on ${result.nextFlightDate}.`
          : `Flight ${result.flightNumber} has already landed at ${result.landedTime}.`;

        logger.info(
          `[API /api/search-flight] Flight ${result.flightNumber} has already landed on ${result.requestedDate} at ${result.landedTime}`,
        );

        return Response.json(
          {
            success: true,
            message,
            flight: null,
          },
          {
            status: 200,
            headers: {
              // Don't cache time-sensitive messages
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          },
        );
      }

      case "notFound": {
        logger.info(`[API /api/search-flight] Flight ${flightNumber} not found for ${pickupDate}`);
        return Response.json(
          {
            success: false,
            error: `Flight ${flightNumber.toUpperCase()} not found landing on ${pickupDate}. Please verify the flight number and date.`,
          },
          {
            status: 404,
            headers: {
              // Don't cache "not found" responses - flight schedules change
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          },
        );
      }

      case "error": {
        logger.error(`[API /api/search-flight] Error: ${result.message}`);

        // Check for specific error types
        if (result.message.includes("API key")) {
          return Response.json(
            {
              success: false,
              error:
                "Flight validation service is temporarily unavailable. Please try again later.",
            },
            { status: 503 },
          );
        }

        if (result.message.includes("rate limit")) {
          return Response.json(
            {
              success: false,
              error: "Too many requests. Please try again in a few minutes.",
            },
            { status: 429 },
          );
        }

        return Response.json(
          {
            success: false,
            error:
              result.message ||
              "An error occurred while searching for the flight. Please try again.",
          },
          { status: 500 },
        );
      }
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
