import { data, type ActionFunctionArgs } from "react-router";
import { Flight, FlightStatus } from "@prisma/client";
import { format, formatDuration } from "date-fns";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderFlightArrivalEmail,
  renderFlightCancellationEmail,
  renderFlightDelayEmail,
  renderFlightDiversionEmail,
  renderFlightGateChangeEmail,
} from "~/modules/email/templates/flight-notifications";
import { Template, sendMessage } from "~/modules/messaging/messaging.server";
import { emailQueue } from "~/queues/email-throttle.server";
import {
  getFlightByAlertId,
  getFlightWithBookings,
  updateFlightStatus,
  type FlightWithBookings,
} from "~/services/flight.server";
import { env } from "~/utils/server/env.server";

/**
 * FlightAware Webhook Handler
 * Receives real-time flight status updates from FlightAware AeroAPI
 */

interface FlightAwareWebhookPayload {
  alert_id: string;
  event_type: string; // "arrival", "departure", "cancelled", "diverted"
  event_time: string; // ISO timestamp
  flight: {
    ident: string;
    fa_flight_id: string;
    registration?: string;
    aircraft_type?: string;
    origin: {
      code: string;
      code_iata?: string;
      name?: string;
      city?: string;
    };
    destination: {
      code: string;
      code_iata?: string;
      name?: string;
      city?: string;
    };
    scheduled_off?: string;
    scheduled_on?: string;
    scheduled_in?: string;
    estimated_off?: string;
    estimated_on?: string;
    estimated_in?: string;
    actual_off?: string;
    actual_on?: string;
    actual_in?: string;
    status?: string;
    delay_minutes?: number;
    gate_origin?: string;
    gate_destination?: string;
  };
}

/**
 * Verify webhook request is from FlightAware
 * Note: FlightAware only allows URL configuration (no custom headers),
 * so we use query param for secret verification.
 * URL will be: https://yourdomain.com/api/webhooks/flightaware?secret=YOUR_SECRET
 */
function verifyWebhookRequest(request: Request): boolean {
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret");

  if (providedSecret !== env.FLIGHTAWARE_WEBHOOK_SECRET) {
    logger.error("Invalid webhook secret", {
      hasSecret: !!providedSecret,
    });
    return false;
  }

  return true;
}

// ============================================================================
// Notification Helper Types and Functions
// ============================================================================

interface RecipientInfo {
  email: string;
  phone: string | null;
  name: string;
}

interface NotificationContext {
  bookingId: string;
  flightNumber: string;
  bookingReference: string;
  customerName: string;
}

/**
 * Queue an email notification with error handling
 */
async function queueEmailNotification(
  to: string,
  subject: string,
  htmlPromise: Promise<string>,
  logContext: { type: string; recipient: string; bookingId: string },
) {
  await emailQueue.add(async () => {
    try {
      await sendEmail({ to, subject, html: await htmlPromise });
      logger.info(`${logContext.type} email sent to ${logContext.recipient}`, {
        bookingId: logContext.bookingId,
      });
    } catch (error) {
      logger.error(`${logContext.type} email to ${logContext.recipient} failed`, {
        bookingId: logContext.bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Queue a WhatsApp notification with error handling
 */
async function queueWhatsAppNotification(
  to: string,
  variables: Record<string, string>,
  templateKey: Template,
  logContext: { type: string; recipient: string; bookingId: string },
) {
  await emailQueue.add(async () => {
    try {
      await sendMessage({ to, variables, templateKey });
      logger.info(`${logContext.type} WhatsApp sent to ${logContext.recipient}`, {
        bookingId: logContext.bookingId,
      });
    } catch (error) {
      logger.error(`${logContext.type} WhatsApp to ${logContext.recipient} failed`, {
        bookingId: logContext.bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Notify a recipient via email and optionally WhatsApp
 */
async function notifyRecipient(params: {
  recipient: RecipientInfo;
  recipientRole: "owner" | "driver" | "customer";
  bookingId: string;
  subject: string;
  emailRenderer: () => Promise<string>;
  whatsAppTemplate: Template;
  whatsAppVariables: Record<string, string>;
  logType: string;
}) {
  const logContext = {
    type: params.logType,
    recipient: params.recipientRole,
    bookingId: params.bookingId,
  };

  await queueEmailNotification(
    params.recipient.email,
    params.subject,
    params.emailRenderer(),
    logContext,
  );

  if (params.recipient.phone) {
    await queueWhatsAppNotification(
      params.recipient.phone,
      params.whatsAppVariables,
      params.whatsAppTemplate,
      logContext,
    );
  }
}

/**
 * Format delay minutes into human-readable text
 */
function getDelayText(delayMinutes: number): string {
  return formatDuration({ hours: Math.floor(delayMinutes / 60), minutes: delayMinutes % 60 });
}

/**
 * Format date to display string
 */
function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return format(new Date(date), "MMM dd, yyyy hh:mm a");
}

// ============================================================================
// Status-specific Notification Handlers
// ============================================================================

async function sendArrivalNotifications(
  owner: RecipientInfo,
  driver: RecipientInfo | null,
  ctx: NotificationContext,
  arrivalData: {
    flightDate: string;
    originCode: string;
    destinationCode: string;
    estimatedArrival: string;
    actualArrival: string;
    arrivalGate?: string;
    carName: string;
  },
) {
  const fullData = {
    ...arrivalData,
    bookingReference: ctx.bookingReference,
    customerName: ctx.customerName,
  };

  // Notify owner
  await notifyRecipient({
    recipient: owner,
    recipientRole: "owner",
    bookingId: ctx.bookingId,
    subject: `Flight ${ctx.flightNumber} Arrived`,
    emailRenderer: () =>
      renderFlightArrivalEmail({
        recipientName: owner.name,
        recipientRole: "owner",
        flightNumber: ctx.flightNumber,
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightArrival,
    whatsAppVariables: {
      "1": owner.name,
      "2": ctx.flightNumber,
      "3": ctx.customerName,
      "4": arrivalData.arrivalGate || "N/A",
      "5": ctx.bookingReference,
    },
    logType: "Flight arrival",
  });

  // Notify driver if different from owner
  if (driver && driver.email !== owner.email) {
    await notifyRecipient({
      recipient: driver,
      recipientRole: "driver",
      bookingId: ctx.bookingId,
      subject: `Flight ${ctx.flightNumber} Arrived`,
      emailRenderer: () =>
        renderFlightArrivalEmail({
          recipientName: driver.name,
          recipientRole: "driver",
          flightNumber: ctx.flightNumber,
          ...fullData,
        }),
      whatsAppTemplate: Template.FlightArrival,
      whatsAppVariables: {
        "1": driver.name,
        "2": ctx.flightNumber,
        "3": ctx.customerName,
        "4": arrivalData.arrivalGate || "N/A",
        "5": ctx.bookingReference,
      },
      logType: "Flight arrival",
    });
  }
}

async function sendDelayNotifications(
  owner: RecipientInfo,
  driver: RecipientInfo | null,
  ctx: NotificationContext,
  delayData: {
    flightDate: string;
    originCode: string;
    destinationCode: string;
    delayMinutes: number;
    estimatedArrival: string;
    previousEstimatedArrival: string;
    carName: string;
  },
) {
  const fullData = {
    ...delayData,
    bookingReference: ctx.bookingReference,
    customerName: ctx.customerName,
  };
  const delayText = getDelayText(delayData.delayMinutes);

  // Notify owner
  await notifyRecipient({
    recipient: owner,
    recipientRole: "owner",
    bookingId: ctx.bookingId,
    subject: `Flight ${ctx.flightNumber} Delayed`,
    emailRenderer: () =>
      renderFlightDelayEmail({
        recipientName: owner.name,
        recipientRole: "owner",
        flightNumber: ctx.flightNumber,
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightDelay,
    whatsAppVariables: {
      "1": owner.name,
      "2": ctx.flightNumber,
      "3": delayText,
      "4": delayData.estimatedArrival,
      "5": ctx.customerName,
    },
    logType: "Flight delay",
  });

  // Notify driver if different from owner
  if (driver && driver.email !== owner.email) {
    await notifyRecipient({
      recipient: driver,
      recipientRole: "driver",
      bookingId: ctx.bookingId,
      subject: `Flight ${ctx.flightNumber} Delayed`,
      emailRenderer: () =>
        renderFlightDelayEmail({
          recipientName: driver.name,
          recipientRole: "driver",
          flightNumber: ctx.flightNumber,
          ...fullData,
        }),
      whatsAppTemplate: Template.FlightDelay,
      whatsAppVariables: {
        "1": driver.name,
        "2": ctx.flightNumber,
        "3": delayText,
        "4": delayData.estimatedArrival,
        "5": ctx.customerName,
      },
      logType: "Flight delay",
    });
  }
}

async function sendCancellationNotifications(
  customer: RecipientInfo,
  owner: RecipientInfo,
  driver: RecipientInfo | null,
  ctx: NotificationContext,
  cancellationData: {
    originCode: string;
    destinationCode: string;
    cancellationReason?: string;
    carName: string;
  },
) {
  const fullData = {
    ...cancellationData,
    bookingReference: ctx.bookingReference,
    flightNumber: ctx.flightNumber,
  };

  // Notify customer
  await notifyRecipient({
    recipient: customer,
    recipientRole: "customer",
    bookingId: ctx.bookingId,
    subject: `Flight ${ctx.flightNumber} Cancelled - Booking Action Required`,
    emailRenderer: () =>
      renderFlightCancellationEmail({
        recipientName: customer.name,
        recipientRole: "customer",
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightCancellationCustomer,
    whatsAppVariables: {
      "1": customer.name,
      "2": ctx.flightNumber,
      "3": cancellationData.originCode,
      "4": cancellationData.destinationCode,
      "5": ctx.bookingReference,
    },
    logType: "Flight cancellation",
  });

  // Notify owner
  await notifyRecipient({
    recipient: owner,
    recipientRole: "owner",
    bookingId: ctx.bookingId,
    subject: `Flight ${ctx.flightNumber} Cancelled`,
    emailRenderer: () =>
      renderFlightCancellationEmail({
        recipientName: owner.name,
        recipientRole: "owner",
        customerName: ctx.customerName,
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightCancellationOwnerDriver,
    whatsAppVariables: {
      "1": owner.name,
      "2": ctx.flightNumber,
      "3": ctx.customerName,
      "4": ctx.bookingReference,
    },
    logType: "Flight cancellation",
  });

  // Notify driver if different from owner
  if (driver && driver.email !== owner.email) {
    await notifyRecipient({
      recipient: driver,
      recipientRole: "driver",
      bookingId: ctx.bookingId,
      subject: `Flight ${ctx.flightNumber} Cancelled`,
      emailRenderer: () =>
        renderFlightCancellationEmail({
          recipientName: driver.name,
          recipientRole: "driver",
          customerName: ctx.customerName,
          ...fullData,
        }),
      whatsAppTemplate: Template.FlightCancellationOwnerDriver,
      whatsAppVariables: {
        "1": driver.name,
        "2": ctx.flightNumber,
        "3": ctx.customerName,
        "4": ctx.bookingReference,
      },
      logType: "Flight cancellation",
    });
  }
}

async function sendDiversionNotifications(
  customer: RecipientInfo,
  owner: RecipientInfo,
  driver: RecipientInfo | null,
  ctx: NotificationContext,
  diversionData: {
    originCode: string;
    destinationCode: string;
    newDestinationCode: string;
    newDestinationName?: string;
    carName: string;
  },
) {
  const fullData = {
    ...diversionData,
    bookingReference: ctx.bookingReference,
    flightNumber: ctx.flightNumber,
  };

  // Notify customer
  await notifyRecipient({
    recipient: customer,
    recipientRole: "customer",
    bookingId: ctx.bookingId,
    subject: `Flight ${ctx.flightNumber} Diverted - Booking Action Required`,
    emailRenderer: () =>
      renderFlightDiversionEmail({
        recipientName: customer.name,
        recipientRole: "customer",
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightDiversionCustomer,
    whatsAppVariables: {
      "1": customer.name,
      "2": ctx.flightNumber,
      "3": diversionData.destinationCode,
      "4": diversionData.newDestinationCode,
      "5": ctx.bookingReference,
    },
    logType: "Flight diversion",
  });

  // Notify owner
  await notifyRecipient({
    recipient: owner,
    recipientRole: "owner",
    bookingId: ctx.bookingId,
    subject: `Flight ${ctx.flightNumber} Diverted`,
    emailRenderer: () =>
      renderFlightDiversionEmail({
        recipientName: owner.name,
        recipientRole: "owner",
        customerName: ctx.customerName,
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightDiversionOwnerDriver,
    whatsAppVariables: {
      "1": owner.name,
      "2": ctx.flightNumber,
      "3": ctx.customerName,
      "4": diversionData.newDestinationCode,
      "5": ctx.bookingReference,
    },
    logType: "Flight diversion",
  });

  // Notify driver if different from owner
  if (driver && driver.email !== owner.email) {
    await notifyRecipient({
      recipient: driver,
      recipientRole: "driver",
      bookingId: ctx.bookingId,
      subject: `Flight ${ctx.flightNumber} Diverted`,
      emailRenderer: () =>
        renderFlightDiversionEmail({
          recipientName: driver.name,
          recipientRole: "driver",
          customerName: ctx.customerName,
          ...fullData,
        }),
      whatsAppTemplate: Template.FlightDiversionOwnerDriver,
      whatsAppVariables: {
        "1": driver.name,
        "2": ctx.flightNumber,
        "3": ctx.customerName,
        "4": diversionData.newDestinationCode,
        "5": ctx.bookingReference,
      },
      logType: "Flight diversion",
    });
  }
}

async function sendGateChangeNotifications(
  owner: RecipientInfo,
  driver: RecipientInfo | null,
  ctx: NotificationContext,
  gateData: {
    flightDate: string;
    originCode: string;
    destinationCode: string;
    oldGate: string | null;
    newGate: string;
    carName: string;
  },
) {
  const fullData = {
    ...gateData,
    oldGate: gateData.oldGate ?? undefined, // Convert null to undefined for type compatibility
    bookingReference: ctx.bookingReference,
    customerName: ctx.customerName,
  };

  // Notify owner
  await notifyRecipient({
    recipient: owner,
    recipientRole: "owner",
    bookingId: ctx.bookingId,
    subject: `Gate Changed for Flight ${ctx.flightNumber}`,
    emailRenderer: () =>
      renderFlightGateChangeEmail({
        recipientName: owner.name,
        recipientRole: "owner",
        flightNumber: ctx.flightNumber,
        ...fullData,
      }),
    whatsAppTemplate: Template.FlightGateChange,
    whatsAppVariables: {
      "1": owner.name,
      "2": ctx.flightNumber,
      "3": gateData.oldGate || "N/A",
      "4": gateData.newGate,
      "5": ctx.customerName,
    },
    logType: "Flight gate change",
  });

  // Notify driver if different from owner
  if (driver && driver.email !== owner.email) {
    await notifyRecipient({
      recipient: driver,
      recipientRole: "driver",
      bookingId: ctx.bookingId,
      subject: `Gate Changed for Flight ${ctx.flightNumber}`,
      emailRenderer: () =>
        renderFlightGateChangeEmail({
          recipientName: driver.name,
          recipientRole: "driver",
          flightNumber: ctx.flightNumber,
          ...fullData,
        }),
      whatsAppTemplate: Template.FlightGateChange,
      whatsAppVariables: {
        "1": driver.name,
        "2": ctx.flightNumber,
        "3": gateData.oldGate || "N/A",
        "4": gateData.newGate,
        "5": ctx.customerName,
      },
      logType: "Flight gate change",
    });
  }
}

// ============================================================================
// Main Notification Orchestrator
// ============================================================================

/**
 * Resolves the driver recipient from booking data.
 * Returns the chauffeur if assigned, owner if owner-driver, or null.
 */
function resolveDriverRecipient(
  booking: FlightWithBookings["bookings"][number],
  owner: RecipientInfo,
): RecipientInfo | null {
  if (booking.chauffeur) {
    return {
      email: booking.chauffeur.email,
      phone: booking.chauffeur.phoneNumber,
      name: booking.chauffeur.name || booking.chauffeur.email,
    };
  }
  if (booking.car.owner?.isOwnerDriver) {
    return owner;
  }
  return null;
}

/**
 * Send flight notifications to all relevant parties
 * Customers are notified for cancellations/diversions (need to modify booking or contact support)
 * Owners and drivers are notified for all events
 */
async function sendFlightNotifications({
  booking,
  flight,
  flightData,
}: {
  booking: FlightWithBookings["bookings"][number];
  flight: Flight;
  flightData: FlightAwareWebhookPayload["flight"];
}) {
  const newStatus = flight.status;

  // Build recipient info
  const guestUser = booking.guestUser as {
    email?: string;
    name?: string;
    phoneNumber?: string;
  } | null;

  const customer: RecipientInfo = {
    email: booking.user ? booking.user.email : (guestUser?.email ?? ""),
    phone: booking.user ? (booking.user.phoneNumber ?? null) : (guestUser?.phoneNumber ?? null),
    name: booking.user
      ? (booking.user.name ?? booking.user.email ?? "")
      : (guestUser?.name ?? guestUser?.email ?? ""),
  };

  const owner: RecipientInfo = {
    email: booking.car.owner.email,
    phone: booking.car.owner.phoneNumber,
    name: booking.car.owner.name || booking.car.owner.email,
  };

  const driver = resolveDriverRecipient(booking, owner);

  const ctx: NotificationContext = {
    bookingId: booking.id,
    flightNumber: flight.flightNumber,
    bookingReference: booking.bookingReference,
    customerName: customer.name,
  };

  const carName = `${booking.car.make} ${booking.car.model}`;
  const flightDate = format(new Date(flight.flightDate), "MMM dd, yyyy");
  const originCode = flight.originCode;
  const destinationCode = flight.destinationCode;

  // Dispatch based on status
  switch (newStatus) {
    case FlightStatus.ARRIVED:
      await sendArrivalNotifications(owner, driver, ctx, {
        flightDate,
        originCode,
        destinationCode,
        estimatedArrival: formatDateTime(
          flightData.estimated_in ? new Date(flightData.estimated_in) : flight.estimatedArrival,
        ),
        actualArrival: formatDateTime(
          flightData.actual_in ? new Date(flightData.actual_in) : flight.actualArrival,
        ),
        arrivalGate: flightData.gate_destination,
        carName,
      });
      break;

    case FlightStatus.CANCELLED:
      await sendCancellationNotifications(customer, owner, driver, ctx, {
        originCode,
        destinationCode,
        cancellationReason: flightData.status,
        carName,
      });
      break;

    case FlightStatus.DIVERTED:
      await sendDiversionNotifications(customer, owner, driver, ctx, {
        originCode,
        destinationCode,
        newDestinationCode: flightData.destination.code_iata || flightData.destination.code,
        newDestinationName: flightData.destination.name,
        carName,
      });
      break;

    default: {
      // Check for delay notifications (delay is tracked via delayMinutes field, not status)
      const delayMinutes = flightData.delay_minutes || flight.delayMinutes;
      if (delayMinutes && delayMinutes > 0) {
        await sendDelayNotifications(owner, driver, ctx, {
          flightDate,
          originCode,
          destinationCode,
          delayMinutes,
          estimatedArrival: formatDateTime(
            flightData.estimated_in ? new Date(flightData.estimated_in) : flight.estimatedArrival,
          ),
          previousEstimatedArrival: formatDateTime(flight.scheduledArrival),
          carName,
        });
      }

      // Gate change notification
      if (flightData.gate_destination && flight.arrivalGate !== flightData.gate_destination) {
        await sendGateChangeNotifications(owner, driver, ctx, {
          flightDate,
          originCode,
          destinationCode,
          oldGate: flight.arrivalGate,
          newGate: flightData.gate_destination,
          carName,
        });
      }
      break;
    }
  }
}

/**
 * Map FlightAware event types to our FlightStatus enum
 *
 * Event codes from FlightAware webhooks:
 * - "departure" / "departed" - Flight has departed
 * - "arrival" / "arrived" - Flight has arrived
 * - "cancelled" - Flight cancelled
 * - "diverted" - Flight diverted
 * - "filed" - Flight plan filed
 * - "change" - Flight plan modified
 * - "minutes_out" - 30-45 mins from destination
 */
function mapEventTypeToStatus(
  eventType: string,
  flightData: FlightAwareWebhookPayload["flight"],
): FlightStatus {
  const eventLower = eventType.toLowerCase();

  if (eventLower.includes("departure") || eventLower === "departed") {
    return FlightStatus.DEPARTED;
  }

  if (eventLower.includes("arrival") || eventLower === "arrived") {
    return FlightStatus.ARRIVED;
  }

  if (eventLower.includes("cancel")) {
    return FlightStatus.CANCELLED;
  }

  if (eventLower.includes("divert")) {
    return FlightStatus.DIVERTED;
  }

  // Check flight status field for more details
  if (flightData.status) {
    const statusLower = flightData.status.toLowerCase().replaceAll(/[\s_-]/g, "");
    if (
      statusLower.includes("enroute") ||
      statusLower.includes("airborne") ||
      statusLower === "active"
    ) {
      return FlightStatus.IN_AIR;
    }
    if (statusLower.includes("landed") || statusLower.includes("arrived")) {
      return FlightStatus.ARRIVED;
    }
  }

  return FlightStatus.SCHEDULED;
}

/**
 * Marks a flight status event as processed with no notifications sent.
 */
async function markEventProcessedNoNotifications(eventId: string, flightId: string) {
  await prisma.flightStatusEvent.update({
    where: { id: eventId },
    data: { processed: true },
  });

  logger.info("No bookings associated with flight, skipping notifications", {
    flightId,
  });

  return { success: true, bookingCount: 0 };
}

/**
 * Formats error details for logging.
 */
function formatErrorForLogging(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return { message, stack };
}

/**
 * POST /api/webhooks/flightaware
 * Webhook endpoint for FlightAware alerts
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  // Verify webhook request
  if (!verifyWebhookRequest(request)) {
    logger.error("Unauthorized webhook request");
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse webhook payload
    const payload: FlightAwareWebhookPayload = await request.json();
    const { alert_id, event_type, flight, event_time } = payload;

    logger.info("Received FlightAware webhook", {
      alertId: alert_id,
      eventType: event_type,
      flightNumber: flight.ident,
      eventTime: event_time,
    });

    // Find flight by alert ID
    const flightRecord = await getFlightByAlertId(alert_id);

    if (!flightRecord) {
      logger.warn("No flight found for alert_id", { alertId: alert_id });
      return data({ error: "Flight not found" }, { status: 404 });
    }

    // Check for duplicate event (idempotency)
    const existingEvent = await prisma.flightStatusEvent.findFirst({
      where: {
        flightId: flightRecord.id,
        eventType: event_type,
        eventTime: new Date(event_time),
      },
    });

    if (existingEvent?.processed) {
      logger.info("Duplicate event detected, skipping", {
        flightId: flightRecord.id,
        eventType: event_type,
        eventTime: event_time,
      });
      return { success: true, duplicate: true };
    }

    // Determine new status based on event type
    const oldStatus = flightRecord.status;
    const newStatus = mapEventTypeToStatus(event_type, flight);

    // Use transaction to ensure atomic update of flight and event creation
    // This prevents inconsistent state if one operation fails
    const { updatedFlight, statusEvent } = await prisma.$transaction(async (tx) => {
      // Update flight record
      const updatedFlight = await tx.flight.update({
        where: { id: flightRecord.id },
        data: {
          status: newStatus,
          estimatedArrival: flight.estimated_in ? new Date(flight.estimated_in) : undefined,
          actualArrival: flight.actual_in ? new Date(flight.actual_in) : undefined,
          actualDeparture: flight.actual_off ? new Date(flight.actual_off) : undefined,
          delayMinutes: flight.delay_minutes,
          arrivalGate: flight.gate_destination,
          departureGate: flight.gate_origin,
          lastUpdated: new Date(),
        },
      });

      logger.info("Flight status updated", {
        flightId: updatedFlight.id,
        oldStatus,
        newStatus: updatedFlight.status,
        delayMinutes: updatedFlight.delayMinutes,
      });

      // Create flight status event record for audit trail
      const statusEvent = await tx.flightStatusEvent.create({
        data: {
          flightId: flightRecord.id,
          eventType: event_type,
          eventTime: new Date(event_time),
          eventData: JSON.stringify(payload),
          oldStatus,
          newStatus,
          delayChange: flight.delay_minutes,
          processed: false, // Will be marked true after notifications sent
        },
      });

      logger.info("Flight status event created", {
        eventId: statusEvent.id,
        flightId: flightRecord.id,
        eventType: event_type,
      });

      return { updatedFlight, statusEvent };
    });

    // Fetch flight with all associated bookings for notifications
    const flightWithBookings = await getFlightWithBookings(flightRecord.id);

    if (!flightWithBookings || flightWithBookings.bookings.length === 0) {
      return markEventProcessedNoNotifications(statusEvent.id, flightRecord.id);
    }

    logger.info("Found bookings for flight", {
      flightId: flightRecord.id,
      bookingCount: flightWithBookings.bookings.length,
    });

    // Send notifications for each booking
    for (const booking of flightWithBookings.bookings) {
      await sendFlightNotifications({
        booking,
        flight: updatedFlight,
        flightData: flight,
      });
    }

    // Mark event as processed
    await prisma.flightStatusEvent.update({
      where: { id: statusEvent.id },
      data: {
        processed: true,
        notificationsSent: true,
      },
    });

    logger.info("Flight status event processed and notifications sent", {
      flightId: flightRecord.id,
      eventType: event_type,
      statusEventId: statusEvent.id,
      bookingCount: flightWithBookings.bookings.length,
    });

    return {
      success: true,
      flightId: flightRecord.id,
      bookingCount: flightWithBookings.bookings.length,
      newStatus: updatedFlight.status,
    };
  } catch (error) {
    const errorDetails = formatErrorForLogging(error);
    logger.error("Webhook processing failed", {
      error: errorDetails.message,
      stack: errorDetails.stack,
    });

    return data(
      {
        error: "Internal server error",
        message: errorDetails.message,
      },
      { status: 500 },
    );
  }
}
