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
  endOfDay,
  getHours,
  getMilliseconds,
  getMinutes,
  getSeconds,
  isWithinInterval,
  set,
  startOfDay,
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
  // Calculate total amount based on days and car price
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  const totalAmount = car.price * days;

  // Create booking but don't update car status yet since payment is still pending
  const booking = await prisma.booking.create({
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
    },
    include: {
      car: { include: { owner: true } },
      user: true,
    },
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
        extensions: true,
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

  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  const totalAmount = car.price * days;

  // Create booking and update car status
  const booking = await prisma.$transaction(async (transaction) => {
    // Create the booking
    const booking = await transaction.booking.create({
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
        paymentId,
        status,
        paymentStatus,
      },
      include: {
        car: { include: { owner: true } },
        user: true,
      },
    });

    // Update car status to BOOKED
    await transaction.car.update({
      where: { id: carId },
      data: { status: "BOOKED" },
    });

    return booking;
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
        extensions: true,
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
      extensions: true,
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
    // Find all confirmed bookings where start date is today
    const bookingsToUpdate = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        chauffeurId: { not: null },
        // startDate: new Date(), will this work
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
        extensions: true,
      },
    });

    if (bookingsToUpdate.length === 0) {
      return "No bookings to update";
    }

    for (const booking of bookingsToUpdate) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACTIVE },
      });

      const html = await renderBookingStatusUpdateEmail(booking);

      await emailQueue.add(() =>
        sendEmail({
          to: booking.user?.email ?? booking.guestUser?.email,
          subject: "Your booking has started",
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
        extensions: true,
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

      await emailQueue.add(() =>
        sendEmail({
          to: booking.user?.email ?? booking.guestUser?.email,
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
    const now = new Date(); // Current time

    // Define start and end of today using date-fns for clarity
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);

    // Fetch bookings that are active today
    const activeBookingsToday = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        // Prisma requires Date objects or compatible date strings.
        // startOfDay/endOfDay return Date objects.
        startDate: {
          lte: endOfToday, // Booking must have started on or before the end of today
        },
        endDate: {
          gte: startOfToday, // Booking must end on or after the start of today
        },
        car: {
          status: Status.BOOKED,
        },
      },
      include: {
        car: {
          include: {
            owner: true,
          },
        },
        user: true,
        chauffeur: true,
        extensions: true,
      },
    });

    if (activeBookingsToday.length === 0) {
      return "No active bookings today, so no reminders to send";
    }

    // Calculate the time 60 minutes from now using date-fns
    const timeIn60Minutes = addMinutes(now, 60);

    // Determine the 1-minute reminder window using date-fns
    // Corresponds to [now + 60 mins]:00.000 to [now + 60 mins]:59.999
    const reminderWindowGTE = set(timeIn60Minutes, { seconds: 0, milliseconds: 0 });
    const reminderWindowLTE = set(timeIn60Minutes, { seconds: 59, milliseconds: 999 });
    const reminderInterval = { start: reminderWindowGTE, end: reminderWindowLTE };

    const bookingsToSendReminders = [];

    for (const booking of activeBookingsToday) {
      // Ensure booking.startDate is a valid Date object for date-fns functions
      // Prisma typically returns Date objects, but parsing might be necessary
      // if it returns strings. new Date() handles common formats.
      const bookingStartDateOriginal = new Date(booking.startDate);

      // Calculate the booking's effective start time for *today*
      // using date-fns: start of today + original start time components
      const effectiveBookingStartOnCurrentDate = set(startOfDay(now), {
        // Base is start of today
        hours: getHours(bookingStartDateOriginal),
        minutes: getMinutes(bookingStartDateOriginal),
        seconds: getSeconds(bookingStartDateOriginal),
        milliseconds: getMilliseconds(bookingStartDateOriginal),
      });

      // Check if this effective start time falls within the reminder window using date-fns
      if (isWithinInterval(effectiveBookingStartOnCurrentDate, reminderInterval)) {
        bookingsToSendReminders.push(booking);
      }
    }

    if (bookingsToSendReminders.length === 0) {
      return "No reminders to send for the current reminder window";
    }

    // --- Email Sending Logic (remains the same) ---
    for (const booking of bookingsToSendReminders) {
      // Send reminder to client
      const clientHtml = await renderBookingReminderEmail(booking, "client");
      await emailQueue.add(() =>
        sendEmail({
          to: booking.user?.email ?? booking.guestUser?.email,
          subject: "Booking Reminder - Your booking starts in 1 hour",
          html: clientHtml,
        }),
      );

      // Send reminder to chauffeur if assigned
      if (booking.chauffeur?.email) {
        const chauffeurHtml = await renderBookingReminderEmail(booking, "chauffeur");
        await emailQueue.add(() =>
          sendEmail({
            to: booking.chauffeur?.email,
            subject: "Booking Reminder - You have a booking starting in 1 hour",
            html: chauffeurHtml,
          }),
        );
      }
    }

    await emailQueue.onIdle();

    return `Sent reminders for ${bookingsToSendReminders.length} bookings`;
  } catch (error: unknown) {
    logger.error(
      `Error sending booking start reminder emails: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw error;
  }
}

export async function sendBookingEndReminderEmails() {
  try {
    const now = new Date(); // Current time

    // --- Calculate Reminder Window ---
    // Determine the time 60 minutes from now using date-fns
    const timeIn60Minutes = addMinutes(now, 60);

    // Define the 1-minute reminder window for the endDate using date-fns
    // This targets bookings ending exactly within that specific minute, 1 hour from now.
    // e.g., If now is 10:15:30, window is [11:15:00.000, 11:15:59.999]
    const reminderWindowGTE = set(timeIn60Minutes, { seconds: 0, milliseconds: 0 });
    const reminderWindowLTE = set(timeIn60Minutes, { seconds: 59, milliseconds: 999 });
    // --- End Calculate Reminder Window ---

    // --- Fetch Bookings ---
    // Step 1: Fetch bookings that are active and whose car is booked.
    // We remove the direct endDate filter from the Prisma query itself,
    // as the effective endDate depends on whether a relevant extension exists.
    const potentiallyEndingBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        car: {
          status: Status.BOOKED,
        },
      },
      include: {
        car: {
          include: {
            owner: true,
          },
        },
        user: true,
        chauffeur: true,
        extensions: {
          // Include paid extensions, as these are likely the active/confirmed ones
          where: {
            paymentStatus: PaymentStatus.PAID,
          },
        },
      },
    });

    // Step 2: Filter in JavaScript to determine the true effective endDate and check against the reminder window.
    const bookingsEndingSoon = potentiallyEndingBookings.filter((booking) => {
      const reminderGTE_Date = new Date(reminderWindowGTE); // Ensure Date objects for comparison
      const reminderLTE_Date = new Date(reminderWindowLTE);

      // Default to booking's original endDate. This handles cases where no extensions exist,
      // or no relevant extension for the last day is found.
      let effectiveEndDate = new Date(booking.endDate);

      // Check if there are any paid extensions for this booking.
      if (booking.extensions?.length) {
        // Determine the start of the day of the booking's original endDate.
        // Extensions are typically keyed by the start of the day they apply to.
        const bookingOriginalEndDay = startOfDay(new Date(booking.endDate));

        // Find if there's a paid extension specifically for that day.
        const lastDayExtension = booking.extensions.find((ext) => {
          const extensionDay = startOfDay(new Date(ext.day)); // ext.day should be start of day
          return extensionDay.getTime() === bookingOriginalEndDay.getTime();
        });

        // If a relevant extension for the last day is found, use its endDate.
        if (lastDayExtension?.endDate) {
          effectiveEndDate = new Date(lastDayExtension.endDate);
        }
      }

      // Check if this effectiveEndDate falls within the reminder window.
      return effectiveEndDate >= reminderGTE_Date && effectiveEndDate <= reminderLTE_Date;
    });

    if (bookingsEndingSoon.length === 0) {
      return "No booking end reminders to send for the current window";
    }

    // --- Send Emails ---
    for (const booking of bookingsEndingSoon) {
      // Send reminder to client
      // The 'false' argument likely indicates to renderBookingReminderEmail this is an 'end' reminder
      const clientHtml = await renderBookingReminderEmail(booking, "client", false);
      const clientEmail = booking.user?.email ?? (booking.guestUser as { email?: string })?.email;
      if (clientEmail) {
        await emailQueue.add(() =>
          sendEmail({
            to: clientEmail,
            subject: "Booking Reminder - Your booking ends in 1 hour",
            html: clientHtml,
          }),
        );
      }

      // Send reminder to chauffeur if assigned
      if (booking.chauffeur?.email) {
        const chauffeurHtml = await renderBookingReminderEmail(booking, "chauffeur", false);
        const chauffeurEmail = booking.chauffeur.email; // Assign to variable
        await emailQueue.add(() =>
          sendEmail({
            to: chauffeurEmail,
            subject: "Booking Reminder - You have a booking ending in 1 hour",
            html: chauffeurHtml,
          }),
        );
      }
    }

    await emailQueue.onIdle();
    // --- End Send Emails ---

    return `Sent booking end reminders for ${bookingsEndingSoon.length} bookings`;
  } catch (error: unknown) {
    logger.error(
      `Error sending booking end reminder emails: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
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
