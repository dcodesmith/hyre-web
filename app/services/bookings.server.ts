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
  addDays,
  differenceInHours,
  eachDayOfInterval,
  endOfDay,
  isSameDay,
  setHours,
  startOfDay,
  subMilliseconds,
} from "date-fns";
import { Decimal } from "decimal.js";
import { customAlphabet } from "nanoid";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import { BookingWithRelations } from "~/types";

export const SECURITY_DETAIL_COST = 30000;

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
  includeSecurityDetail?: boolean;
};

// Define your alphabet (e.g., uppercase letters and numbers, avoiding ambiguous chars like 0/O, 1/I)
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const nanoid = customAlphabet(alphabet, 8); // Generate an 8-character ID

export async function generateUniqueBookingReference(): Promise<string> {
  while (true) {
    const reference = `BK-${nanoid()}`; // e.g., "BK-4U9A1V8Z"

    const existingBooking = await prisma.booking.findUnique({
      where: { bookingReference: reference },
      select: { id: true },
    });

    if (!existingBooking) {
      return reference;
    }
    logger.info(`Collision detected for reference ${reference}. Regenerating...`);
  }
}

export async function calculateBookingCost({
  car,
  startDate,
  endDate,
  type,
  includeSecurityDetail,
  prismaInstance = prisma,
}: {
  car: { dayRate: number; nightRate: number; hourlyRate: number; id: string };
  startDate: Date;
  endDate: Date;
  type: BookingType;
  includeSecurityDetail?: boolean;
  prismaInstance?: Prisma.TransactionClient | typeof prisma;
}) {
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

  // Calculate the net total (sum of all leg prices)
  const netTotal = legPrices
    .map((legPrice) => new Decimal(legPrice))
    .reduce((sum, legPrice) => sum.plus(legPrice), new Decimal(0));
  logger.debug(`Net Total (sum of leg prices): ${netTotal.toString()}`);

  const securityDetailCost = includeSecurityDetail
    ? new Decimal(SECURITY_DETAIL_COST).mul(bookingDates.length)
    : new Decimal(0);

  const netTotalWithSecurity = netTotal.plus(securityDetailCost);

  // Get current platform fee rates
  const platformFeeRates = await prismaInstance.platformFeeRate.findFirst({
    where: {
      feeType: "PLATFORM_SERVICE_FEE",
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
  });

  if (!platformFeeRates) {
    throw new Error("No active platform service fee rate found");
  }

  // Get fleet owner commission rate
  const fleetOwnerCommissionRate = await prismaInstance.platformFeeRate.findFirst({
    where: {
      feeType: "FLEET_OWNER_COMMISSION",
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
  });

  if (!fleetOwnerCommissionRate) {
    throw new Error("No active fleet owner commission rate found");
  }

  // Get current VAT rate
  const vatRate = await prismaInstance.taxRate.findFirst({
    where: {
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
  });

  if (!vatRate) {
    throw new Error("No active VAT rate found");
  }

  // Calculate platform service fee
  const platformCustomerServiceFeeRatePercent = new Decimal(
    platformFeeRates.ratePercent.toString(),
  );
  logger.debug(`Platform Service Fee Rate: ${platformCustomerServiceFeeRatePercent.toString()}%`);
  const platformCustomerServiceFeeAmount = netTotalWithSecurity
    .mul(platformCustomerServiceFeeRatePercent)
    .div(100);
  logger.debug(`Platform Service Fee Amount: ${platformCustomerServiceFeeAmount.toString()}`);

  // Calculate subtotal before VAT
  const subtotalBeforeVat = netTotalWithSecurity.plus(platformCustomerServiceFeeAmount);
  logger.debug(`Subtotal Before VAT: ${subtotalBeforeVat.toString()}`);

  // Calculate VAT
  const vatRatePercent = new Decimal(vatRate.ratePercent.toString());
  logger.debug(`VAT Rate: ${vatRatePercent.toString()}%`);
  const vatAmount = subtotalBeforeVat.mul(vatRatePercent).div(100);
  logger.debug(`VAT Amount: ${vatAmount.toString()}`);

  // Calculate total amount (gross)
  const totalAmount = subtotalBeforeVat.plus(vatAmount);
  logger.debug(`Total Amount (Gross): ${totalAmount.toString()}`);

  // Calculate fleet owner commission and payout
  const platformFleetOwnerCommissionRatePercent = new Decimal(
    fleetOwnerCommissionRate.ratePercent.toString(),
  );
  logger.debug(
    `Fleet Owner Commission Rate: ${platformFleetOwnerCommissionRatePercent.toString()}%`,
  );
  const platformFleetOwnerCommissionAmount = netTotal
    .mul(platformFleetOwnerCommissionRatePercent)
    .div(100);
  logger.debug(`Fleet Owner Commission Amount: ${platformFleetOwnerCommissionAmount.toString()}`);
  const fleetOwnerPayoutAmountNet = netTotal.minus(platformFleetOwnerCommissionAmount);
  logger.debug(`Fleet Owner Payout Amount (Net): ${fleetOwnerPayoutAmountNet.toString()}`);

  // Log the complete breakdown
  logger.debug(`Complete Calculation Breakdown:
      Net Total: ${netTotal.toString()}
      Security Detail Cost: ${securityDetailCost.toString()}
      Net Total with Security: ${netTotalWithSecurity.toString()}
      Platform Service Fee (${platformCustomerServiceFeeRatePercent.toString()}%): ${platformCustomerServiceFeeAmount.toString()}
      Subtotal Before VAT: ${subtotalBeforeVat.toString()}
      VAT (${vatRatePercent.toString()}%): ${vatAmount.toString()}
      Total Amount (Gross): ${totalAmount.toString()}
      Fleet Owner Commission (${platformFleetOwnerCommissionRatePercent.toString()}%): ${platformFleetOwnerCommissionAmount.toString()}
      Fleet Owner Payout (Net): ${fleetOwnerPayoutAmountNet.toString()}
    `);

  return {
    totalAmount,
    netTotal,
    platformCustomerServiceFeeRatePercent,
    platformCustomerServiceFeeAmount,
    subtotalBeforeVat,
    vatRatePercent,
    vatAmount,
    platformFleetOwnerCommissionRatePercent,
    platformFleetOwnerCommissionAmount,
    fleetOwnerPayoutAmountNet,
    bookingDates,
    startHours,
    endHours,
    legPrices,
  };
}

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
  includeSecurityDetail,
}: Omit<CreateBookingParams, "paymentId" | "status" | "paymentStatus"> & {
  paymentIntent: string;
}) {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");
  const bookingReference = await generateUniqueBookingReference();

  const booking = await prisma.$transaction(async (transaction) => {
    const {
      totalAmount,
      netTotal,
      platformCustomerServiceFeeRatePercent,
      platformCustomerServiceFeeAmount,
      subtotalBeforeVat,
      vatRatePercent,
      vatAmount,
      platformFleetOwnerCommissionRatePercent,
      platformFleetOwnerCommissionAmount,
      fleetOwnerPayoutAmountNet,
      bookingDates,
      startHours,
      endHours,
      legPrices,
    } = await calculateBookingCost({
      car,
      startDate,
      endDate,
      type,
      includeSecurityDetail,
      prismaInstance: transaction,
    });

    const query = {
      data: {
        bookingReference,
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

        netTotal,
        platformCustomerServiceFeeRatePercent,
        platformCustomerServiceFeeAmount,
        subtotalBeforeVat,
        vatRatePercent,
        vatAmount,
        platformFleetOwnerCommissionRatePercent,
        platformFleetOwnerCommissionAmount,
        fleetOwnerPayoutAmountNet,
        legs: {
          create: bookingDates.map((legDate, index) => {
            // Calculate the net value for this leg (base price before fees)
            const itemsNetValueForLeg = fleetOwnerPayoutAmountNet
              .div(bookingDates.length)
              .toDecimalPlaces(2);

            // Calculate fleet owner earning for this leg
            const fleetOwnerEarningForLeg = fleetOwnerPayoutAmountNet
              .div(bookingDates.length)
              .toDecimalPlaces(2);

            return {
              legDate: setHours(legDate, 1), // Ensure legDate is set to the start of the day
              legStartTime: setHours(legDate, startHours),
              legEndTime:
                endHours < startHours
                  ? setHours(addDays(legDate, 1), endHours) // If end time is less than start time, it's on the next day
                  : setHours(legDate, endHours),
              totalDailyPrice: legPrices[index],
              itemsNetValueForLeg,
              // platformCommissionRateOnLeg: platformFleetOwnerCommissionRatePercent, // ?
              // platformCommissionAmountOnLeg, // ?
              fleetOwnerEarningForLeg,
            };
          }),
        },
      },
      include: {
        legs: true,
        car: { include: { owner: true, images: true } },
        user: true,
      },
    };

    const newBooking = await transaction.booking.create(query);

    logger.debug("From createPendingBooking: newBooking:", newBooking);
    return newBooking;
  });

  return booking;
}

// Find a booking by its payment intent
export async function findBookingByPaymentIntent(paymentIntent: string) {
  return prisma.booking.findFirst({
    where: { paymentIntent },
    include: {
      car: { include: { owner: true } },
      user: true,
    },
  });
}

// Activate a booking after successful payment
export async function activateBooking(
  bookingId: string,
  paymentId: string,
): Promise<BookingWithRelations> {
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
        chauffeur: true,
        legs: { include: { extensions: true } },
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
  car: { dayRate: number; nightRate: number; hourlyRate: number },
  booking: { startDate: Date; endDate: Date; type: BookingType },
  legDate: Date,
): number {
  const { dayRate, nightRate, hourlyRate } = car;
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
        chauffeur: true,
        legs: { include: { extensions: true } },
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
    paymentStatus: {
      in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
    },
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
