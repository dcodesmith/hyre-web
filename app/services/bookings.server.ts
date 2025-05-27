import {
  BookingStatus,
  BookingType,
  CarApprovalStatus,
  FleetOwnerStatus,
  PaymentStatus,
  Prisma,
  Status,
  User,
} from "@prisma/client";
import {
  addMinutes,
  differenceInHours,
  eachDayOfInterval,
  endOfDay,
  getHours,
  getMilliseconds,
  getMinutes,
  getSeconds,
  isSameDay,
  isValid,
  isWithinInterval,
  set,
  setHours,
  startOfDay,
  subMilliseconds,
} from "date-fns";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingReminderEmail,
  renderBookingStatusUpdateEmail,
} from "~/modules/email/templates/booking-notification";
import { emailQueue } from "~/queues/email-throttle.server";

export type CreateBookingParams = {
  startDate: Date;
  endDate: Date;
  carId: string;
  user: User | { email: string; name: string; phoneNumber: string };
  pickupLocation: string;
  returnLocation: string;
  specialRequests?: string;
  paymentId?: string;
  paymentIntent?: string;
  type: BookingType;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
};

// Create a pending booking with payment intent
export async function createPendingBooking({
  startDate,
  endDate,
  carId,
  user,
  pickupLocation,
  returnLocation,
  specialRequests,
  paymentIntent,
  type,
}: Omit<CreateBookingParams, "paymentId" | "status" | "paymentStatus"> & {
  paymentIntent: string;
}) {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");

  const booking = await prisma.$transaction(async (transaction) => {
    let effectiveEndDateForLegGeneration = endDate;

    // If the endDate is exactly at midnight (00:00:00.000),
    // subtract a tiny amount to ensure it falls on the previous calendar day
    // for the purpose of leg generation.
    if (
      endDate.getHours() === 0 &&
      endDate.getMinutes() === 0 &&
      endDate.getSeconds() === 0 &&
      endDate.getMilliseconds() === 0
    ) {
      effectiveEndDateForLegGeneration = subMilliseconds(endDate, 1);
    }

    // First, calculate all leg prices to determine the totalAmount for the Booking
    const bookingDates = eachDayOfInterval({
      start: startDate,
      end: effectiveEndDateForLegGeneration,
    });
    const legPrices: number[] = [];
    const startHours = startDate.getHours();
    const endHours = endDate.getHours();

    logger.debug(`From createPendingBooking: startHours: ${startHours}, endHours: ${endHours}`);
    logger.debug(`From createPendingBooking: bookingDates: ${bookingDates}`);

    // Temporary booking object shape for price calculation
    const tempBookingDataForPricing = { startDate, endDate, type };

    for (const legDate of bookingDates) {
      const dailyPrice = calculateBookingLegPrice(car, tempBookingDataForPricing, legDate);
      legPrices.push(dailyPrice);
    }

    const totalAmount = legPrices.reduce((sum, price) => sum + price, 0);

    const query = {
      data: {
        startDate,
        endDate,
        carId,
        type,
        ...("id" in user
          ? { userId: user.id }
          : { guestUser: { email: user.email, name: user.name, phoneNumber: user.phoneNumber } }),
        pickupLocation,
        returnLocation,
        specialRequests,
        totalAmount,
        paymentIntent,
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        legs: {
          create: bookingDates.map((legDate, index) => ({
            legDate: setHours(legDate, 1), // Ensure legDate is set to the start of the day
            legStartTime: setHours(legDate, startHours),
            legEndTime: setHours(legDate, endHours),
            totalDailyPrice: legPrices[index],
          })),
        },
      },
      include: {
        car: { include: { owner: true } },
        user: true,
        legs: true,
      },
    };

    logger.debug(`From createPendingBooking: query: ${JSON.stringify(query, null, 2)}`);

    const newBooking = await transaction.booking.create(query);

    logger.debug(`From createPendingBooking: newBooking: ${JSON.stringify(newBooking, null, 2)}`);
    return newBooking;
  });

  return booking;
}

// Find a booking by its payment intent
export async function findBookingByPaymentIntent(paymentIntent: string) {
  return prisma.booking.findFirst({
    where: { paymentIntent },
    include: {
      car: { include: { owner: true, images: true } },
      user: true,
    },
  });
}

// Activate a booking after successful payment
export async function activateBooking(bookingId: string, paymentId: string) {
  return prisma.$transaction(async (transaction) => {
    // Update the booking
    const booking = await transaction.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentId,
      },
      include: {
        car: { include: { owner: true } },
        user: true,
      },
    });

    // Update car status to BOOKED
    await transaction.car.update({
      where: { id: booking.carId },
      data: { status: Status.BOOKED },
    });

    return booking;
  });
}

// Clean up abandoned pending bookings
export async function cleanupPendingBookings(olderThan: Date) {
  // Get all pending bookings that are older than the specified date
  const pendingBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      createdAt: { lt: olderThan },
    },
    select: { id: true },
  });

  // Cancel all found bookings
  const results = await Promise.all(
    pendingBookings.map((booking) =>
      cancelBooking(booking.id, "Payment not completed in the allotted time"),
    ),
  );

  return { count: results.length };
}

// Calculate the price for a single booking leg
function calculateBookingLegPrice(
  car: { price: number; nightRate: number; hourlyRate: number },
  booking: { startDate: Date; endDate: Date; type: BookingType },
  legDate: Date,
): number {
  const { price: dayRate, nightRate, hourlyRate } = car;
  const { startDate, endDate, type } = booking;

  // Ensure rates are positive, default to 0 if not
  const validDayRate = Math.max(0, dayRate);
  const validNightRate = Math.max(0, nightRate);
  const validHourlyRate = Math.max(0, hourlyRate);

  // Minimum chargeable unit, e.g., 1 hour.
  // This could also be a global constant or configurable.
  const MINIMUM_CHARGEABLE_HOURS = 1;

  if (type === BookingType.NIGHT) {
    // For NIGHT bookings, charge the flat nightRate for any leg.
    // This assumes a night booking covers a period that falls on this legDate.
    return validNightRate;
  }

  // BookingType.DAY calculations
  const bookingStartDateTime = startDate;
  const bookingEndDateTime = endDate;

  const legStartDateTime = startOfDay(legDate);
  const legEndDateTime = endOfDay(legDate);

  const isFirstLeg = isSameDay(legDate, bookingStartDateTime);
  const isLastLeg = isSameDay(legDate, bookingEndDateTime);

  // Determine the actual service start and end times for *this specific leg*
  const actualServiceStartTimeOnLeg = isFirstLeg ? bookingStartDateTime : legStartDateTime;
  const actualServiceEndTimeOnLeg = isLastLeg ? bookingEndDateTime : legEndDateTime;

  // Calculate duration of service on this leg in hours
  let durationHours = differenceInHours(actualServiceEndTimeOnLeg, actualServiceStartTimeOnLeg);

  // Ensure a minimum duration for calculation if there's any overlap
  if (durationHours <= 0 && actualServiceEndTimeOnLeg > actualServiceStartTimeOnLeg) {
    durationHours = MINIMUM_CHARGEABLE_HOURS; // if less than 1 hr but there is service, charge for 1hr.
  } else if (durationHours < 0) {
    durationHours = 0; // Should not happen if dates are logical
  }

  // Ensure duration does not exceed 24 hours for a single leg calculation
  durationHours = Math.min(durationHours, 24);

  // Handle cases based on leg position and booking duration

  // Case 1: Single-day DAY booking (first leg and last leg are the same)
  if (isFirstLeg && isLastLeg) {
    if (validHourlyRate > 0) {
      // If hourly rate is defined, calculate cost based on hours, up to the daily rate.
      // Apply a minimum charge equivalent to MINIMUM_CHARGEABLE_HOURS.
      const hourlyCost = Math.max(durationHours, MINIMUM_CHARGEABLE_HOURS) * validHourlyRate;
      return Math.min(hourlyCost, validDayRate);
    }
    // If no hourly rate, or if it's a full day anyway, charge the full day rate.
    return validDayRate;
  }

  // Case 2: Multi-day DAY booking - First leg (partial day)
  if (isFirstLeg) {
    if (validHourlyRate > 0) {
      // Calculate cost based on actual hours on this first day.
      // Example: Booking starts at 2 PM. legDate is for this first day.
      // durationHours would be from 2 PM to midnight (approx 10 hours).
      // Apply a minimum charge.
      const hourlyCost = Math.max(durationHours, MINIMUM_CHARGEABLE_HOURS) * validHourlyRate;
      return Math.min(hourlyCost, validDayRate); // Cap at the full dayRate
    }
    // If no hourly rate, charge full day rate for the first partial day.
    return validDayRate;
  }

  // Case 3: Multi-day DAY booking - Last leg (partial day)
  if (isLastLeg) {
    if (validHourlyRate > 0) {
      // Calculate cost based on actual hours on this last day.
      // Example: Booking ends at 10 AM. legDate is for this last day.
      // durationHours would be from midnight to 10 AM (approx 10 hours).
      // Apply a minimum charge.
      const hourlyCost = Math.max(durationHours, MINIMUM_CHARGEABLE_HOURS) * validHourlyRate;
      return Math.min(hourlyCost, validDayRate); // Cap at the full dayRate
    }
    // If no hourly rate, charge full day rate for the last partial day.
    return validDayRate;
  }

  // Case 4: Full intermediate day in a multi-day DAY booking
  // This leg is neither the first nor the last, so it's a full 24-hour period within the booking.
  return validDayRate;
}

export async function confirmBooking({
  startDate,
  endDate,
  carId,
  user,
  pickupLocation,
  returnLocation,
  specialRequests,
  paymentId,
  type,
  status = BookingStatus.CONFIRMED,
  paymentStatus = PaymentStatus.PAID,
}: CreateBookingParams) {
  // Calculate total amount based on days and car price
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");

  // This totalAmount might need to be re-evaluated or simply taken from the pending booking
  // For now, let's assume it's correctly set during pending booking or payment confirmation updates it.
  // Or, if the pending booking's totalAmount (sum of legs) is the source of truth,
  // we might not need to recalculate it here at all if it's passed through.
  // The original calculation is kept for now but commented out as it might be redundant.
  // const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  // const totalAmount = car.price * days;

  // Create booking and update car status - This function might be deprecated or changed
  // if createPendingBooking now handles legs and activateBooking handles confirmation.
  // For now, removing leg creation from here.
  const booking = await prisma.$transaction(async (transaction) => {
    // If this function is still used to create a *new* confirmed booking (not from pending),
    // it would need its own leg creation logic.
    // However, the typical flow is pending -> confirmed.

    // Let's assume this function might be used to directly create a confirmed booking
    // or update a pending one. If updating, we'd fetch the pending booking first.
    // For simplicity, and aligning with the idea that legs are created with pending,
    // this simplified version just creates the booking record.
    // The totalAmount here should ideally come from a reliable source (e.g. payment service or pre-calculated pending booking)

    // Fetch the pending booking to get its already calculated totalAmount (sum of legs)
    // This is a conceptual step; in reality, payment confirmation might pass this or the bookingId
    const pendingBooking = await transaction.booking.findFirst({
      where: { paymentIntent: paymentId }, // Assuming paymentId might be a paymentIntent here for lookup
      // or we'd need another way to link to the pending booking.
      // This part is a bit speculative without knowing the exact flow.
      select: { totalAmount: true },
    });

    const bookingTotalAmount = pendingBooking?.totalAmount ?? 0; // Fallback, ideally always found

    const newBooking = await transaction.booking.create({
      data: {
        startDate,
        endDate,
        carId,
        type,
        ...("id" in user
          ? { userId: user.id }
          : { guestUser: { email: user.email, name: user.name, phoneNumber: user.phoneNumber } }),
        pickupLocation,
        returnLocation,
        specialRequests,
        totalAmount: bookingTotalAmount, // Use amount from pending/payment
        paymentId,
        status,
        paymentStatus,
      },
      include: {
        car: { include: { owner: true } },
        user: true,
        // Legs should have been created with the pending booking.
        // If we need them here, we'd include them.
      },
    });

    // If booking legs were NOT created in pending, they would be created here.
    // But we've moved that logic.

    // Update car status to BOOKED
    await transaction.car.update({
      where: { id: carId },
      data: { status: "BOOKED" },
    });

    return newBooking;
  });

  return booking;
}

export async function cancelBooking(bookingId: string, reason: string) {
  return prisma.$transaction(async (transaction) => {
    const booking = await transaction.booking.update({
      where: {
        id: bookingId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
      data: {
        status: BookingStatus.CANCELLED,
        paymentStatus: PaymentStatus.REFUNDED, // TODO: if payment status is PAID, we should refund the payment and update status, if not, we should not change it
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        user: true,
        car: { include: { owner: true } },
      },
    });

    // Free up the car
    await transaction.car.update({
      where: { id: booking.carId },
      data: { status: Status.AVAILABLE },
    });

    return booking;
  });
}

export async function getMonthToDateBookingsValue(fleetOwnerId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1); // Set to first day of current month
  startOfMonth.setHours(0, 0, 0, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      car: {
        ownerId: fleetOwnerId,
      },
      startDate: {
        gte: startOfMonth,
        lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      endDate: {
        gte: startOfMonth,
        lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      status: "COMPLETED",
      paymentStatus: "PAID",
    },
    select: {
      totalAmount: true,
    },
  });

  return bookings.reduce((sum, booking) => sum + booking.totalAmount.toNumber(), 0);
}

export async function getUserBookings(email: string, isGuest = false) {
  const where: Prisma.BookingWhereInput = {
    paymentStatus: PaymentStatus.PAID,
    ...(isGuest
      ? {
          guestUser: { path: ["email"], equals: email },
        }
      : {
          user: { email },
        }),
  };

  return prisma.booking.findMany({
    where,
    include: {
      car: { include: { images: true } },
      chauffeur: true,
      legs: { include: { extensions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveBookings() {
  return prisma.booking.findMany({
    where: {
      status: {
        in: ["CONFIRMED", "ACTIVE"],
      },
    },
    include: {
      car: true,
      user: true,
    },
  });
}

export async function isCarAvailableForDates(carId: string, from: Date, to: Date) {
  // Find any overlapping bookings
  const overlappingBookings = await prisma.booking.findFirst({
    where: {
      carId,
      // Check that car is available
      car: {
        status: "AVAILABLE",
      },
      // Check for date overlap
      OR: [
        // Case 1: Booking starts during requested period
        {
          startDate: {
            gte: from,
            lte: to,
          },
        },
        // Case 2: Booking ends during requested period
        {
          endDate: {
            gte: from,
            lte: to,
          },
        },
        // Case 3: Booking encompasses requested period
        {
          startDate: {
            lte: from,
          },
          endDate: {
            gte: to,
          },
        },
      ],
    },
  });

  return overlappingBookings === null;
}

export async function getBooking(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { car: { include: { owner: true } }, chauffeur: true },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    return booking;
  } catch (error) {
    logger.error("Error getting booking:", error);
    throw error;
  }
}

export async function getBookingsByStatus(userId: string, isGuest = false) {
  const bookings = await getUserBookings(userId, isGuest);

  return bookings.reduce(
    (acc, booking) => {
      const status = booking.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(booking);
      // Sort bookings by date/time, most recent first
      acc[status].sort((a, b) => {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
      return acc;
    },
    {} as Record<keyof typeof BookingStatus, typeof bookings>,
  );
}

export async function updateBookingsFromConfirmedToActive() {
  try {
    const today = new Date();

    const todayUtcYear = today.getUTCFullYear(); // Native Date method
    const todayUtcMonth = today.getUTCMonth(); // Native Date method (0-indexed)
    const todayUtcDay = today.getUTCDate(); // Native Date method

    // Construct start and end of "today" in UTC
    const start = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999));

    // Find all confirmed bookings where start date is today
    const bookingsToUpdate = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        chauffeurId: { not: null },
        startDate: {
          gte: new Date(new Date().setMinutes(0, 0, 0)),
          lte: new Date(new Date().setMinutes(59, 59, 999)),
          // gte: new Date(new Date().setHours(0, 0, 0, 0)),
          // lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        car: {
          status: Status.BOOKED,
        },
      },
      include: {
        car: true,
        user: true,
        legs: { include: { extensions: true } },
      },
    });

    if (bookingsToUpdate.length === 0) {
      logger.info("No bookings to update from confirmed to active");
      return "No bookings to update";
    }

    for (const booking of bookingsToUpdate) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACTIVE },
      });

      const html = await renderBookingStatusUpdateEmail(booking);
      const guestUserEmail = (booking.guestUser as { email?: string })?.email;

      await emailQueue.add(() =>
        sendEmail({
          to: booking.user?.email ?? guestUserEmail!,
          subject: "Your booking has started",
          html,
        }),
      );
    }

    await emailQueue.onIdle();
  } catch (error) {
    logger.error(
      `Error updating booking statuses: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error;
  }
}

export async function updateBookingsFromActiveToCompleted() {
  try {
    // Find all confirmed bookings where start date is today
    const bookingsToUpdate = await prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        // startDate: new Date(), will this work
        endDate: {
          gte: new Date(new Date().setMinutes(0, 0, 0)),
          lte: new Date(new Date().setMinutes(59, 59, 999)),

          // gte: new Date(new Date().setHours(0, 0, 0, 0)),
          // lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        car: {
          status: Status.BOOKED,
        },
      },
      include: {
        car: true,
        user: true,
        legs: { include: { extensions: true } },
      },
    });

    if (bookingsToUpdate.length === 0) {
      return "No bookings to update";
    }

    for (const booking of bookingsToUpdate) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.COMPLETED },
      });

      // Free up the car
      await prisma.car.update({
        where: { id: booking.carId },
        data: { status: Status.AVAILABLE },
      });

      const html = await renderBookingStatusUpdateEmail(booking);
      const guestUserEmail = (booking.guestUser as { email?: string })?.email;

      await emailQueue.add(() =>
        sendEmail({
          to: booking.user?.email ?? guestUserEmail!,
          subject: "Your booking has ended",
          html,
        }),
      );
    }
    await emailQueue.onIdle();
  } catch (error) {
    logger.error(`Error updating booking statuses: ${error}`);
    throw error;
  }
}

export async function sendBookingStartReminderEmails() {
  try {
    const now = new Date();
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);

    // Define the reminder window: for services starting approximately 60 minutes from now.
    // This window covers one minute, e.g., if now is 10:00, window is 11:00:00 to 11:00:59.
    const reminderTargetTime = addMinutes(now, 60);
    const reminderWindowStart = set(reminderTargetTime, { seconds: 0, milliseconds: 0 });
    const reminderWindowEnd = set(reminderTargetTime, { seconds: 59, milliseconds: 999 });
    const reminderInterval = { start: reminderWindowStart, end: reminderWindowEnd };

    logger.info(
      `Checking for booking legs starting today. Reminder window: ${reminderWindowStart.toISOString()} - ${reminderWindowEnd.toISOString()}`,
    );

    // 1. Fetch BookingLegs for today whose parent booking meets criteria.
    const relevantLegs = await prisma.bookingLeg.findMany({
      where: {
        legDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
        booking: {
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          car: { status: Status.BOOKED },
        },
      },
      include: {
        booking: {
          include: {
            user: true,
            chauffeur: true,
            car: { include: { owner: true } },
          },
        },
      },
    });

    if (relevantLegs.length === 0) {
      logger.info(
        "No booking legs found for today matching initial criteria. No reminders to send.",
      );
      return "No relevant booking legs today, so no reminders to send.";
    }

    const bookingsToReceiveReminders = [];

    for (const leg of relevantLegs) {
      const parentBooking = leg.booking;
      const originalBookingStartDate = new Date(parentBooking.startDate);

      const effectiveStartTimeForLeg = set(new Date(leg.legDate), {
        hours: getHours(originalBookingStartDate),
        minutes: getMinutes(originalBookingStartDate),
        seconds: getSeconds(originalBookingStartDate),
        milliseconds: getMilliseconds(originalBookingStartDate),
      });

      // 2. Check if this leg's effective start time falls within the reminder window
      if (isWithinInterval(effectiveStartTimeForLeg, reminderInterval)) {
        bookingsToReceiveReminders.push(parentBooking);
      }
    }

    if (bookingsToReceiveReminders.length === 0) {
      logger.info("No bookings have legs starting in the current reminder window.");
      return "No reminders to send for the current reminder window.";
    }

    // Deduplicate parent bookings. Since each leg is for a unique day of a booking (due to @@unique([bookingId, legDate])),
    // this primarily ensures that if multiple distinct bookings happen to have legs starting at the exact same time,
    // they are all processed. If the same booking object was somehow added multiple times, it'd be deduplicated.
    const uniqueBookingsForEmail = Array.from(
      new Map(bookingsToReceiveReminders.map((b) => [b.id, b])).values(),
    );

    logger.info(
      `Preparing to send reminders for ${uniqueBookingsForEmail.length} unique bookings.`,
    );

    // 3. Send emails for the filtered bookings
    for (const booking of uniqueBookingsForEmail) {
      const clientUser = booking.user;
      const guestInfo = booking.guestUser as { email?: string } | null; // guestUser is JSON

      let targetClientEmail = clientUser?.email;

      if (!targetClientEmail && guestInfo?.email) {
        targetClientEmail = guestInfo.email;
      }

      if (targetClientEmail) {
        logger.info(
          `Simulating: render and queue client email for booking ${booking.id} to ${targetClientEmail}`,
        );
        const clientHtml = await renderBookingReminderEmail(booking, "client");
        await emailQueue.add(async () =>
          sendEmail({
            to: targetClientEmail,
            subject: "Booking Reminder - Your service starts in approximately 1 hour",
            html: clientHtml,
          }),
        );
      } else {
        logger.warn(`No client email (user or guest) found for booking ${booking.id}.`);
      }

      const chauffeurEmail = booking.chauffeur?.email;

      if (chauffeurEmail) {
        logger.info(
          `Simulating: render and queue chauffeur email for booking ${booking.id} to ${chauffeurEmail}`,
        );
        const chauffeurHtml = await renderBookingReminderEmail(booking, "chauffeur");
        await emailQueue.add(async () =>
          sendEmail({
            to: chauffeurEmail,
            subject: "Booking Reminder - You have a service starting in approximately 1 hour",
            html: chauffeurHtml,
          }),
        );
      }
    }

    // await emailQueue.onIdle(); // Wait for all emails in the queue to be processed
    logger.info("Simulating: email queue processing complete.");

    return `Processed reminders for ${uniqueBookingsForEmail.length} bookings. (Email sending simulated)`;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in sendBookingStartReminderEmails: ${errorMessage}`, {
      errorDetails: error,
    });
    // Re-throw the error so the caller (e.g., a job scheduler) knows the task failed.
    throw error;
  }
}

export async function sendBookingEndReminderEmails() {
  try {
    const now = new Date(); // Current time

    // Define UTC day boundaries for querying legDate using date-fns for component extraction
    // const todayUtcYear = getUTCFullYear(now);
    // const todayUtcMonth = getUTCMonth(now); // 0-indexed
    // const todayUtcDay = getUTCDate(now);
    // const startOfTodayUTC = new Date(
    //   Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0),
    // );
    // const endOfTodayUTC = new Date(
    //   Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999),
    // );

    // (now is a new Date())
    const todayUtcYear = now.getUTCFullYear(); // Native Date method
    const todayUtcMonth = now.getUTCMonth(); // Native Date method (0-indexed)
    const todayUtcDay = now.getUTCDate(); // Native Date method

    // Construct start and end of "today" in UTC
    const startOfTodayUTC = new Date(
      Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 0, 0, 0, 0),
    );
    const endOfTodayUTC = new Date(
      Date.UTC(todayUtcYear, todayUtcMonth, todayUtcDay, 23, 59, 59, 999),
    );

    // Define the reminder window (local time) using date-fns
    const reminderTargetTime = addMinutes(now, 60);
    const reminderWindowStart = set(reminderTargetTime, { seconds: 0, milliseconds: 0 });
    const reminderWindowEnd = set(reminderTargetTime, { seconds: 59, milliseconds: 999 });
    const reminderInterval = { start: reminderWindowStart, end: reminderWindowEnd };

    logger.info(
      `Checking for booking legs ending today. Reminder window (local): ${reminderWindowStart.toISOString()} - ${reminderWindowEnd.toISOString()}`,
    );

    const legsEndingToday = await prisma.bookingLeg.findMany({
      where: {
        legDate: {
          gte: startOfTodayUTC,
          lte: endOfTodayUTC,
        },
        booking: {
          status: BookingStatus.ACTIVE,
          paymentStatus: PaymentStatus.PAID,
          car: {
            status: Status.BOOKED,
          },
        },
      },
      include: {
        extensions: {
          where: {
            paymentStatus: PaymentStatus.PAID,
            status: "ACTIVE",
          },
          orderBy: { extensionEndTime: "desc" },
        },
        booking: {
          select: {
            id: true,
            endDate: true,
          },
        },
      },
    });

    if (legsEndingToday.length === 0) {
      logger.info(
        "No booking legs found for today meeting initial criteria. No end reminders to send.",
      );
      return "No relevant booking legs today, so no end reminders to send.";
    }

    const bookingIdsForReminders = new Set<string>();

    for (const leg of legsEndingToday) {
      let effectiveEndTimeForLeg: Date;
      const latestActivePaidExtension = leg.extensions?.[0];

      if (latestActivePaidExtension?.extensionEndTime) {
        // extensionEndTime from Prisma is already a Date object
        effectiveEndTimeForLeg = latestActivePaidExtension.extensionEndTime;
      } else {
        // parentBooking.endDate and leg.legDate from Prisma are already Date objects
        const parentBookingEndDate = leg.booking.endDate;
        effectiveEndTimeForLeg = set(leg.legDate, {
          // Base date is the leg's actual date object
          hours: getHours(parentBookingEndDate),
          minutes: getMinutes(parentBookingEndDate),
          seconds: getSeconds(parentBookingEndDate),
          milliseconds: getMilliseconds(parentBookingEndDate),
        });
      }

      // Use date-fns isValid for checking date validity
      if (!isValid(effectiveEndTimeForLeg)) {
        logger.warn(
          `Could not determine valid effective end time for leg ${leg.id} of booking ${leg.booking.id}.`,
        );
        continue;
      }

      if (isWithinInterval(effectiveEndTimeForLeg, reminderInterval)) {
        bookingIdsForReminders.add(leg.booking.id);
      }
    }

    if (bookingIdsForReminders.size === 0) {
      logger.info("No bookings have legs ending in the current reminder window.");
      return "No end-of-booking reminders to send for the current reminder window.";
    }

    const uniqueBookingIds = Array.from(bookingIdsForReminders);
    const bookingsToSendEmailFor = await prisma.booking.findMany({
      where: {
        id: { in: uniqueBookingIds },
      },
      include: {
        user: true,
        chauffeur: true,
        car: { include: { owner: true } },
        legs: {
          orderBy: { legDate: "asc" },
          include: {
            extensions: {
              where: { paymentStatus: PaymentStatus.PAID, status: "ACTIVE" },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    logger.info(
      `Preparing to send end reminders for ${bookingsToSendEmailFor.length} unique bookings.`,
    );

    for (const booking of bookingsToSendEmailFor) {
      const clientUser = booking.user;
      const guestInfo = booking.guestUser as { email?: string } | null;

      let targetClientEmail: string | undefined = undefined;
      if (clientUser?.email) {
        targetClientEmail = clientUser.email;
      } else if (guestInfo?.email) {
        targetClientEmail = guestInfo.email;
      }

      if (targetClientEmail) {
        logger.info(
          `Queuing client end reminder for booking ${booking.id} to ${targetClientEmail}`,
        );
        const clientHtml = await renderBookingReminderEmail(booking, "client", false);
        await emailQueue.add(async () =>
          sendEmail({
            to: targetClientEmail,
            subject: "Booking Reminder - Your service ends in approximately 1 hour",
            html: clientHtml,
          }),
        );
      } else {
        logger.warn(`No client email found for booking ${booking.id} for end reminder.`);
      }

      const chauffeurEmail = booking.chauffeur?.email;

      if (chauffeurEmail) {
        logger.info(
          `Queuing chauffeur end reminder for booking ${booking.id} to ${chauffeurEmail}`,
        );
        const chauffeurHtml = await renderBookingReminderEmail(booking, "chauffeur", false);
        await emailQueue.add(async () =>
          sendEmail({
            to: chauffeurEmail,
            subject:
              "Booking Reminder - Your assigned booking for today ends in approximately 1 hour",
            html: chauffeurHtml,
          }),
        );
      }
    }

    await emailQueue.onIdle();
    logger.info("Simulating: email queue processing complete for end reminders.");

    return `Processed end reminders for ${bookingsToSendEmailFor.length} bookings.`;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in sendBookingEndReminderEmails: ${errorMessage}`, { errorDetails: error });
    throw error;
  }
}

export async function getAvailableCars(params: {
  startDate: Date;
  endDate: Date;
  // ... other params
}) {
  return prisma.car.findMany({
    where: {
      AND: [
        // ... existing date/booking filters ...
        {
          status: Status.AVAILABLE,
          approvalStatus: CarApprovalStatus.APPROVED,
          owner: {
            fleetOwnerStatus: FleetOwnerStatus.APPROVED,
          },
        },
      ],
    },
    include: {
      owner: true,
      bookings: true,
    },
  });
}

export async function updateCarApprovalStatus(carId: string, status: CarApprovalStatus) {
  return prisma.car.update({
    where: { id: carId },
    data: { approvalStatus: status },
  });
}

export async function updateFleetOwnerStatus(userId: string, status: FleetOwnerStatus) {
  return prisma.user.update({
    where: { id: userId },
    data: { fleetOwnerStatus: status },
  });
}
