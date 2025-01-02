import { BookingStatus, PaymentStatus, Status } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import {
  renderBookingReminder,
  renderBookingTemplate,
} from "~/modules/email/templates/booking-notification";

export type CreateBookingParams = {
  startDate: Date;
  endDate: Date;
  carId: string;
  userId: string;
  pickupLocation: string;
  returnLocation: string;
  specialRequests?: string;
  paymentId: string;
};

export async function confirmBooking({
  startDate,
  endDate,
  carId,
  userId,
  pickupLocation,
  returnLocation,
  specialRequests,
  paymentId,
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
        userId,
        pickupLocation,
        returnLocation,
        specialRequests,
        totalAmount,
        paymentId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
      },
      include: {
        car: { include: { owner: true } },
        user: true,
      },
    });

    // Update car status to BOOKED
    await transaction.car.update({
      where: { id: carId },
      // TODO: perhaps we should use a different status when boxing is yet to be confirmed
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
        car: true,
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

export async function getUserBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    include: {
      car: true,
      chauffeur: true,
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
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { car: true, chauffeur: true },
  });
}

export async function getBookingsByStatus(userId: string) {
  const bookings = await getUserBookings(userId);

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

      const html = await renderBookingTemplate(booking);

      await sendEmail({
        to: booking.user.email,
        subject: "Your booking has started",
        html,
      });
    }
  } catch (error) {
    console.error("Error updating booking statuses:", error);
    throw error;
  }
}

export async function updateBookingsFromActiveToCompleted() {
  try {
    // Find all confirmed bookings where start date is today
    const bookingsToUpdate = await prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
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

      const html = await renderBookingTemplate(booking);

      await sendEmail({
        to: booking.user.email,
        subject: "Your booking has ended",
        html,
      });
    }
  } catch (error) {
    console.error("Error updating booking statuses:", error);
    throw error;
  }
}

export async function sendBookingStartReminderEmails() {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startDate: {
          // Get bookings starting in the next hour
          gte: new Date(new Date().setMinutes(new Date().getMinutes() + 60, 0, 0)),
          lte: new Date(new Date().setMinutes(new Date().getMinutes() + 60, 59, 999)),
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
      },
    });

    if (bookings.length === 0) {
      return "No reminders to send";
    }

    for (const booking of bookings) {
      // Send reminder to client
      const clientHtml = await renderBookingReminder(booking, "client");
      await sendEmail({
        to: booking.user.email,
        subject: "Booking Reminder - Your booking starts in 1 hour",
        html: clientHtml,
      });

      // Send reminder to chauffeur if assigned
      if (booking.chauffeur?.email) {
        const chauffeurHtml = await renderBookingReminder(booking, "chauffeur");
        await sendEmail({
          to: "dcodesmith@gmail.com", // booking.chauffeur.email,
          subject: "Booking Reminder - You have a booking starting in 1 hour",
          html: chauffeurHtml,
        });
      }
    }

    return `Sent reminders for ${bookings.length} bookings`;
  } catch (error) {
    console.error("Error sending booking start reminder emails:", error);
    throw error;
  }
}

export async function sendBookingEndReminderEmails() {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
        endDate: {
          gte: new Date(new Date().setMinutes(new Date().getMinutes() + 60, 0, 0)),
          lte: new Date(new Date().setMinutes(new Date().getMinutes() + 60, 59, 999)),
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
      },
    });

    if (bookings.length === 0) {
      return "No reminders to send";
    }

    for (const booking of bookings) {
      // Send reminder to client
      const clientHtml = await renderBookingReminder(booking, "client", false);
      await sendEmail({
        to: booking.user.email,
        subject: "Booking Reminder - Your booking ends in 1 hour",
        html: clientHtml,
      });

      // Send reminder to chauffeur if assigned
      if (booking.chauffeur?.email) {
        const chauffeurHtml = await renderBookingReminder(booking, "chauffeur", false);
        await sendEmail({
          to: "dcodesmith@gmail.com", // booking.chauffeur.email,
          subject: "Booking Reminder - You have a booking ending in 1 hour",
          html: chauffeurHtml,
        });
      }
    }

    return `Sent reminders for ${bookings.length} bookings`;
  } catch (error) {
    console.error("Error sending booking end reminder emails:", error);
    throw error;
  }
}
