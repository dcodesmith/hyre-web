import { Flight, FlightStatus, Prisma } from "@prisma/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import type { ValidatedFlight } from "./flight-validation.server";

const LAGOS_TIMEZONE = "Africa/Lagos";

/**
 * Flight service - Handles CRUD operations for Flight records
 */

export type FlightWithBookings = Prisma.FlightGetPayload<{
  include: {
    bookings: {
      include: {
        car: {
          include: {
            owner: true;
          };
        };
        chauffeur: true;
        user: true;
      };
    };
    statusEvents: {
      orderBy: {
        eventTime: "desc";
      };
      take: 10;
    };
  };
}>;

/**
 * Find or create a Flight record from FlightAware validation data
 * This ensures we only have one Flight record per flight number + date
 */
export async function findOrCreateFlight(
  validatedFlight: ValidatedFlight,
  _flightDate: Date,
): Promise<Flight> {
  // Calculate the flight date from the arrival time in Lagos timezone
  // This ensures the date matches what users see (arrival date in local time)
  const arrivalTime = validatedFlight.estimatedArrival || validatedFlight.scheduledArrival;
  const arrivalInLagos = toZonedTime(new Date(arrivalTime), LAGOS_TIMEZONE);
  // Format as YYYY-MM-DD in Lagos timezone, then parse as UTC midnight
  const lagosDateStr = format(arrivalInLagos, "yyyy-MM-dd");
  const normalizedDate = new Date(`${lagosDateStr}T00:00:00.000Z`);

  logger.info("Finding or creating flight", {
    flightNumber: validatedFlight.flightNumber,
    flightDate: normalizedDate.toISOString(),
  });

  // Use upsert to avoid race condition (TOCTOU) when creating/updating flights
  // This ensures only one flight record exists per flight number + date
  const newStatus = validatedFlight.status
    ? mapFlightAwareStatusToFlightStatus(validatedFlight.status)
    : FlightStatus.SCHEDULED;

  const flight = await prisma.flight.upsert({
    where: {
      flightNumber_flightDate: {
        flightNumber: validatedFlight.flightNumber.toUpperCase(),
        flightDate: normalizedDate,
      },
    },
    update: {
      // Update existing flight with latest data from API
      status: newStatus,
      estimatedArrival: validatedFlight.estimatedArrival
        ? new Date(validatedFlight.estimatedArrival)
        : undefined,
      actualArrival: validatedFlight.actualArrival
        ? new Date(validatedFlight.actualArrival)
        : undefined,
      delayMinutes: validatedFlight.delay,
      lastUpdated: new Date(),
    },
    create: {
      // Create new flight record
      flightNumber: validatedFlight.flightNumber.toUpperCase(),
      flightDate: normalizedDate,
      faFlightId: validatedFlight.flightId,

      // Route information
      originCode: validatedFlight.origin,
      originCodeIATA: validatedFlight.originIATA,
      destinationCode: validatedFlight.destination,
      destinationCodeIATA: validatedFlight.destinationIATA,
      destinationName: validatedFlight.arrivalAddress,

      // Timing
      scheduledArrival: new Date(validatedFlight.scheduledArrival),
      estimatedArrival: validatedFlight.estimatedArrival
        ? new Date(validatedFlight.estimatedArrival)
        : undefined,
      actualArrival: validatedFlight.actualArrival
        ? new Date(validatedFlight.actualArrival)
        : undefined,

      // Status
      status: newStatus,
      delayMinutes: validatedFlight.delay,
      aircraftType: validatedFlight.aircraftType,

      // Metadata
      isLive: validatedFlight.isLive ?? false,
      dataSource: "FLIGHTAWARE",
    },
  });

  logger.info("Flight upserted successfully", {
    flightId: flight.id,
    flightNumber: flight.flightNumber,
    scheduledArrival: flight.scheduledArrival.toISOString(),
    status: flight.status,
  });

  return flight;
}

/**
 * Update flight status from webhook data
 */
export async function updateFlightStatus(
  flightId: string,
  update: {
    status?: FlightStatus;
    estimatedArrival?: Date;
    actualArrival?: Date;
    actualDeparture?: Date;
    delayMinutes?: number;
    arrivalGate?: string;
    departureGate?: string;
  },
): Promise<Flight> {
  logger.info("Updating flight status", {
    flightId,
    update,
  });

  const updatedFlight = await prisma.flight.update({
    where: { id: flightId },
    data: {
      ...update,
      lastUpdated: new Date(),
    },
  });

  logger.info("Flight status updated", {
    flightId: updatedFlight.id,
    newStatus: updatedFlight.status,
  });

  return updatedFlight;
}

/**
 * Get flight with all associated bookings
 */
export async function getFlightWithBookings(flightId: string): Promise<FlightWithBookings | null> {
  logger.info("Fetching flight with bookings", { flightId });

  const flight = await prisma.flight.findUnique({
    where: { id: flightId },
    include: {
      bookings: {
        include: {
          car: {
            include: {
              owner: true,
            },
          },
          chauffeur: true,
          user: true,
        },
      },
      statusEvents: {
        orderBy: {
          eventTime: "desc",
        },
        take: 10,
      },
    },
  });

  if (!flight) {
    logger.warn("Flight not found", { flightId });
    return null;
  }

  logger.info("Flight fetched with bookings", {
    flightId: flight.id,
    bookingCount: flight.bookings.length,
  });

  return flight;
}

/**
 * Get flight by alert ID
 */
export async function getFlightByAlertId(alertId: string): Promise<Flight | null> {
  logger.info("Finding flight by alertId", { alertId });

  const flight = await prisma.flight.findUnique({
    where: { alertId },
  });

  if (!flight) {
    logger.warn("Flight not found for alertId", { alertId });
    return null;
  }

  logger.info("Flight found", {
    flightId: flight.id,
    flightNumber: flight.flightNumber,
  });

  return flight;
}

/**
 * Update flight with FlightAware alert ID
 */
export async function updateFlightAlertId(flightId: string, alertId: string): Promise<Flight> {
  logger.info("Updating flight with alertId", {
    flightId,
    alertId,
  });

  const updatedFlight = await prisma.flight.update({
    where: { id: flightId },
    data: {
      alertId,
      alertEnabled: true,
      alertCreatedAt: new Date(),
    },
  });

  logger.info("Flight alertId updated", {
    flightId: updatedFlight.id,
    alertId: updatedFlight.alertId,
  });

  return updatedFlight;
}

/**
 * Disable flight alert
 */
export async function disableFlightAlertTracking(flightId: string): Promise<Flight> {
  logger.info("Disabling flight alert", { flightId });

  const updatedFlight = await prisma.flight.update({
    where: { id: flightId },
    data: {
      alertEnabled: false,
      alertDisabledAt: new Date(),
    },
  });

  logger.info("Flight alert disabled", {
    flightId: updatedFlight.id,
  });

  return updatedFlight;
}

/**
 * Helper: Map FlightAware status strings to our FlightStatus enum
 *
 * FlightAware AeroAPI v4 status values (from their OpenAPI spec):
 * - "Scheduled" - Flight is scheduled, not yet departed
 * - "En Route" / "EnRoute" - Flight is currently in the air
 * - "Landed" / "Arrived" - Flight has arrived at destination
 * - "Cancelled" - Flight was cancelled
 * - "Diverted" - Flight was diverted to another airport
 * - "Unknown" / "Result Unknown" - Status cannot be determined
 *
 * Additional values observed in real API responses:
 * - "Active" - Flight is active (in air or taxiing)
 * - "Taxiing Out" / "Taxiing In" - Aircraft on ground movement
 * - "Departed" - Just departed (wheels up)
 * - "On Time" - Scheduled and on time (treated as scheduled)
 * - "Delayed" - Flight is delayed (maps to SCHEDULED, delay tracked in delayMinutes field)
 */
function mapFlightAwareStatusToFlightStatus(status: string): FlightStatus {
  logger.info("Mapping FlightAware status", { rawStatus: status });
  const statusLower = status.toLowerCase().replaceAll(/[_\s-]/g, ""); // Normalize: remove spaces, underscores, hyphens

  // En Route / In air - flight is currently flying
  // Check BEFORE departed since a departed flight in cruise is "en route"
  // Note: FlightAware returns various formats like "En", "En Route", "On The Way! / On Time"
  if (
    statusLower === "en" || // FlightAware abbreviation for "En Route"
    statusLower.includes("enroute") ||
    statusLower.includes("ontheway") || // "On The Way!" indicates in-flight
    statusLower.includes("inair") ||
    statusLower.includes("airborne") ||
    statusLower.includes("inflight") ||
    statusLower === "active" // "Active" alone typically means in-air
  ) {
    return FlightStatus.EN_ROUTE;
  }

  // Landed / Arrived - flight has completed or is taxiing to gate
  if (
    statusLower.includes("arrived") ||
    statusLower.includes("landed") ||
    statusLower.includes("onblock") ||
    statusLower.includes("gatedin") ||
    statusLower.includes("taxiing") // Taxiing after landing
  ) {
    return FlightStatus.LANDED;
  }

  // Departed - just took off or taxiing out
  if (
    statusLower.includes("departed") ||
    statusLower.includes("takeoff") ||
    statusLower.includes("taxiingout") ||
    statusLower.includes("offblock") ||
    statusLower.includes("gatedout")
  ) {
    return FlightStatus.DEPARTED;
  }

  // Cancelled
  if (statusLower.includes("cancel")) {
    return FlightStatus.CANCELLED;
  }

  // Diverted
  if (statusLower.includes("divert")) {
    return FlightStatus.DIVERTED;
  }

  // Scheduled / On Time / Filed / Delayed - flight hasn't departed yet
  // Note: "Delayed" is treated as SCHEDULED since delay is tracked in delayMinutes field
  if (
    statusLower.includes("scheduled") ||
    statusLower.includes("ontime") ||
    statusLower.includes("filed") ||
    statusLower.includes("delayed")
  ) {
    return FlightStatus.SCHEDULED;
  }

  // Unknown / Result Unknown
  if (statusLower.includes("unknown") || statusLower === "resultunknown") {
    return FlightStatus.UNKNOWN;
  }

  // Log any unrecognized status for debugging
  logger.warn("Unrecognized flight status from FlightAware, defaulting to UNKNOWN", {
    originalStatus: status,
    normalizedStatus: statusLower,
  });

  return FlightStatus.UNKNOWN;
}
