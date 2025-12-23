import { format } from "date-fns";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";
import { updateFlightAlertId, disableFlightAlertTracking } from "./flight.server";
import { prisma } from "~/modules/db/db.server";

/**
 * FlightAware Alert Service
 * Manages FlightAware AeroAPI alerts for real-time flight status notifications
 */

interface CreateAlertParams {
  flightNumber: string;
  flightDate: Date;
  destinationIATA?: string;
  events?: string[];
}

interface FlightAwareAlertResponse {
  alert_id: string;
  ident: string;
  enabled: boolean;
  events: string[];
  created_at: string;
}

/**
 * Create a FlightAware alert for a flight
 * POST /alerts
 */
export async function createFlightAlert({
  flightNumber,
  flightDate,
  destinationIATA,
  events = ["arrival", "cancelled", "departure", "diverted"],
}: CreateAlertParams): Promise<string> {
  const dateStr = format(flightDate, "yyyy-MM-dd");

  logger.info("Creating FlightAware alert", {
    flightNumber,
    flightDate: dateStr,
    events,
  });

  const requestBody: Record<string, unknown> = {
    ident: flightNumber.toUpperCase(),
    date_start: dateStr,
    date_end: dateStr,
    enabled: true,
    events,
  };

  // Add destination filter if provided (ensures we only track flights to Lagos)
  if (destinationIATA) {
    requestBody.destination = destinationIATA;
  }

  try {
    const response = await fetch("https://aeroapi.flightaware.com/aeroapi/alerts", {
      method: "POST",
      headers: {
        "x-apikey": env.FLIGHTAWARE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("FlightAware alert creation failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        flightNumber,
      });

      if (response.status === 401) {
        throw new Error("FlightAware API authentication failed. Check API key.");
      }

      if (response.status === 429) {
        throw new Error("FlightAware API rate limit exceeded. Try again later.");
      }

      throw new Error(`FlightAware API error: ${response.status} ${response.statusText}`);
    }

    const data: FlightAwareAlertResponse = await response.json();

    logger.info("FlightAware alert created successfully", {
      alertId: data.alert_id,
      flightNumber: data.ident,
      events: data.events,
    });

    return data.alert_id;
  } catch (error) {
    logger.error("Failed to create FlightAware alert", {
      error: error instanceof Error ? error.message : String(error),
      flightNumber,
      flightDate: dateStr,
    });
    throw error;
  }
}

/**
 * Get or create alert for a flight with deduplication
 * Uses PostgreSQL advisory lock to prevent race conditions (TOCTOU)
 * The lock ensures only one alert creation happens per flightId at a time
 */
export async function getOrCreateFlightAlert(
  flightId: string,
  params: CreateAlertParams,
): Promise<string> {
  logger.info("Getting or creating flight alert", {
    flightId,
    flightNumber: params.flightNumber,
  });

  // Generate a numeric lock ID from flightId for advisory lock
  // Using a simple hash: sum of character codes modulo a large prime
  const lockId =
    Array.from(flightId).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 2147483647;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_lock(${lockId})`;
    logger.debug("Acquired advisory lock for flight alert", { flightId, lockId });

    try {
      const flight = await tx.flight.findUnique({
        where: { id: flightId },
        select: { alertId: true, alertEnabled: true },
      });

      if (flight?.alertId && flight.alertEnabled) {
        logger.info("Flight already has active alert, reusing", {
          flightId,
          alertId: flight.alertId,
        });
        return flight.alertId;
      }
    } finally {
      await tx.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
      logger.debug("Released advisory lock for flight alert", { flightId, lockId });
    }

    const alertId = await createFlightAlert(params);
    await updateFlightAlertId(flightId, alertId);
    logger.info("Created and stored new flight alert", { flightId, alertId });
    return alertId;
  });
}

/**
 * Disable/Delete a FlightAware alert
 * DELETE /alerts/{id}
 */
export async function disableFlightAlert(alertId: string): Promise<void> {
  logger.info("Disabling FlightAware alert", { alertId });

  try {
    const response = await fetch(`https://aeroapi.flightaware.com/aeroapi/alerts/${alertId}`, {
      method: "DELETE",
      headers: {
        "x-apikey": env.FLIGHTAWARE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("FlightAware alert deletion failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        alertId,
      });

      // Don't throw on 404 - alert might already be deleted
      if (response.status === 404) {
        logger.warn("Alert not found (may already be deleted)", { alertId });
        return;
      }

      if (response.status === 401) {
        throw new Error("FlightAware API authentication failed. Check API key.");
      }

      throw new Error(`FlightAware API error: ${response.status} ${response.statusText}`);
    }

    logger.info("FlightAware alert deleted successfully", { alertId });
  } catch (error) {
    logger.error("Failed to delete FlightAware alert", {
      error: error instanceof Error ? error.message : String(error),
      alertId,
    });
    throw error;
  }
}

/**
 * Configure webhook endpoint with FlightAware (one-time setup)
 * PUT /alerts/endpoint
 */
export async function configureWebhookEndpoint(webhookUrl: string): Promise<void> {
  logger.info("Configuring FlightAware webhook endpoint", { webhookUrl });

  try {
    const response = await fetch("https://aeroapi.flightaware.com/aeroapi/alerts/endpoint", {
      method: "PUT",
      headers: {
        "x-apikey": env.FLIGHTAWARE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: webhookUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("FlightAware webhook configuration failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      throw new Error(`FlightAware API error: ${response.status} ${response.statusText}`);
    }

    logger.info("FlightAware webhook endpoint configured successfully", {
      webhookUrl,
    });
  } catch (error) {
    logger.error("Failed to configure FlightAware webhook", {
      error: error instanceof Error ? error.message : String(error),
      webhookUrl,
    });
    throw error;
  }
}

/**
 * Cleanup alert when flight is completed or all bookings cancelled
 */
export async function cleanupFlightAlert(flightId: string): Promise<void> {
  logger.info("Cleaning up flight alert", { flightId });

  // Get flight by ID to check for alert
  const flight = await prisma.flight.findUnique({
    where: { id: flightId },
    select: { alertId: true, alertEnabled: true },
  });

  if (!flight?.alertId || !flight.alertEnabled) {
    logger.info("Flight has no active alert to cleanup", { flightId });
    return;
  }

  // Delete alert from FlightAware
  await disableFlightAlert(flight.alertId);

  // Update flight record
  await disableFlightAlertTracking(flightId);

  logger.info("Flight alert cleaned up successfully", {
    flightId,
    alertId: flight.alertId,
  });
}
