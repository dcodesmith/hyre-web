import {
  BookingReferralStatus,
  BookingStatus,
  BookingType,
  Car,
  CarApprovalStatus,
  FleetOwnerStatus,
  PaymentStatus,
  Prisma,
  Status,
  User,
} from "@prisma/client";
import {
  addDays,
  addHours,
  eachDayOfInterval,
  setHours,
  startOfDay,
  subMilliseconds,
} from "date-fns";
import { Decimal } from "decimal.js";
import { customAlphabet } from "nanoid";
import logger from "~/lib/logger.server";
import { prisma } from "~/modules/db/db.server";
import {
  sendReferralDiscountAppliedNotification,
  sendReferralRewardEarnedNotification,
} from "~/services/referral-notifications.server";
import {
  calculateMaxCreditForBooking,
  checkReferralEligibility,
  getReferralConfig,
  releaseReferralReward,
} from "~/services/referral.server";
import { findOrCreateFlight, disableFlightAlertTracking } from "~/services/flight.server";
import { getOrCreateFlightAlert, disableFlightAlert } from "~/services/flight-alert.server";
import { validateFlight } from "~/services/flight-validation.server";
import { BookingWithRelations } from "~/types";

export type CreateBookingParams = {
  startDate: Date;
  endDate: Date;
  car: Car;
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
  flightNumber?: string;
  estimatedDuration?: number;
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

function generateBookingDates(
  type: BookingType,
  startDate: Date,
  endDate: Date,
  effectiveEndDateForLegGeneration: Date,
): Date[] {
  // Generate legs based on booking type and duration

  if (type === BookingType.NIGHT) {
    // For night bookings, generate legs for each night
    // A night booking from 1st to 2nd should generate 1 leg (the night of 1st-2nd)
    // A night booking from 1st to 3rd should generate 2 legs (nights of 1st-2nd and 2nd-3rd)
    const startDay = startOfDay(startDate);
    const endDay = startOfDay(endDate);
    const daysDiff = Math.ceil((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));

    // For night bookings, the number of legs equals the number of nights
    // Each night spans from one day to the next, so we generate legs for the start days
    // For a night booking from 1st to 2nd: 1 night = 1 leg (1st)
    // For a night booking from 1st to 3rd: 2 nights = 2 legs (1st, 2nd)
    const dates = [];
    for (let i = 0; i < daysDiff; i++) {
      dates.push(addDays(startDay, i));
    }
    return dates;
  }
  if (type === BookingType.FULL_DAY) {
    // For FULL_DAY bookings, generate legs based on 24-hour periods
    // Each leg represents exactly 24 hours from the pickup time
    // Use exact millisecond calculation to match client-side logic
    const totalHours = Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    if (totalHours <= 0) {
      throw new Error("Invalid range: endDate must be after startDate for FULL_DAY bookings");
    }

    const numberOfLegs = Math.max(1, Math.ceil(totalHours / 24));

    const dates = [];
    for (let i = 0; i < numberOfLegs; i++) {
      // Each leg starts at the beginning of its 24-hour period
      dates.push(addHours(startDate, i * 24));
    }
    return dates;
  }
  if (type === BookingType.AIRPORT_PICKUP) {
    // For AIRPORT_PICKUP bookings, generate a single leg with the exact pickup time
    // This is a one-time service, not a multi-day rental
    // Use the actual startDate time (not start of day) to preserve pickup time
    return [startDate];
  }
  // For DAY bookings, generate legs based on 12-hour periods within calendar days
  // Use existing calendar-day logic but with 12-hour duration consideration
  return eachDayOfInterval({
    start: startDate,
    end: effectiveEndDateForLegGeneration,
  });
}

export async function calculateBookingCost({
  car,
  startDate,
  endDate,
  type,
  includeSecurityDetail,
  requiresFullTank,
  prismaInstance = prisma,
  user,
  useCredits,
}: {
  car: {
    dayRate: number;
    nightRate: number;
    hourlyRate: number;
    fullDayRate: number;
    fuelUpgradeRate: number;
    airportPickupRate: number;
    id: string;
  };
  startDate: Date;
  endDate: Date;
  type: BookingType;
  includeSecurityDetail?: boolean;
  requiresFullTank?: boolean;
  useCredits?: number;
  prismaInstance?: Prisma.TransactionClient | typeof prisma;
  user?: { id: string; email: string; name?: string | null; phoneNumber?: string | null } | null;
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

  logger.debug(
    `From calculateBookingCost: startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`,
  );
  logger.debug(
    `From calculateBookingCost: effectiveEndDateForLegGeneration: ${effectiveEndDateForLegGeneration.toISOString()}`,
  );

  const bookingDates = generateBookingDates(
    type,
    startDate,
    endDate,
    effectiveEndDateForLegGeneration,
  );

  const legPrices: number[] = [];
  const startHours = startDate.getHours();
  const endHours = endDate.getHours();

  logger.debug(`From calculateBookingCost: startHours: ${startHours}, endHours: ${endHours}`);
  logger.debug(`From calculateBookingCost: bookingDates: ${bookingDates.length}`);

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

  // Get current platform fee rates
  const platformFeeRates = await prismaInstance.platformFeeRate.findFirst({
    where: {
      feeType: "PLATFORM_SERVICE_FEE",
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
    orderBy: { effectiveSince: "desc" },
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
    orderBy: { effectiveSince: "desc" },
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
    orderBy: { effectiveSince: "desc" },
  });

  if (!vatRate) {
    throw new Error("No active VAT rate found");
  }

  // Get current security detail rate
  const securityDetailAddonRate = await prismaInstance.addonRate.findFirst({
    where: {
      addonType: "SECURITY_DETAIL",
      effectiveSince: { lte: new Date() },
      OR: [{ effectiveUntil: { gt: new Date() } }, { effectiveUntil: null }],
    },
    orderBy: { effectiveSince: "desc" },
  });

  if (!securityDetailAddonRate) {
    throw new Error("No active security detail rate found");
  }

  const securityDetailRate = securityDetailAddonRate.rateAmount.toNumber();

  // Calculate security detail cost using the fetched rate
  const securityDetailCost = includeSecurityDetail
    ? new Decimal(securityDetailRate).mul(bookingDates.length)
    : new Decimal(0);

  // Calculate fuel upgrade cost (only for 1-2 day bookings, same logic as client)
  const fuelUpgradeCost =
    requiresFullTank && bookingDates.length <= 2
      ? new Decimal(car.fuelUpgradeRate)
      : new Decimal(0);

  const netTotalWithSecurityAndFuel = netTotal.plus(securityDetailCost).plus(fuelUpgradeCost);

  // Calculate platform service fee
  const platformCustomerServiceFeeRatePercent = new Decimal(
    platformFeeRates.ratePercent.toString(),
  );
  logger.debug(`Platform Service Fee Rate: ${platformCustomerServiceFeeRatePercent.toString()}%`);

  // Only apply platform service fee if the fee percent is greater than 0
  // Per policy, platform fee excludes security detail but includes fuel upgrade
  const platformFeeBase = netTotal.plus(fuelUpgradeCost);
  const platformCustomerServiceFeeAmount = platformFeeBase
    .mul(Decimal.max(platformCustomerServiceFeeRatePercent, new Decimal(0)))
    .div(100);
  logger.debug(`Platform Service Fee Amount: ${platformCustomerServiceFeeAmount.toString()}`);

  // Calculate subtotal before discounts (before VAT)
  const subtotalBeforeDiscounts = netTotalWithSecurityAndFuel.plus(
    platformCustomerServiceFeeAmount,
  );
  logger.debug(`Subtotal Before Discounts: ${subtotalBeforeDiscounts.toString()}`);

  // Calculate fleet owner commission and payout
  const platformFleetOwnerCommissionRatePercent = new Decimal(
    fleetOwnerCommissionRate.ratePercent.toString(),
  );
  logger.debug(
    `Fleet Owner Commission Rate: ${platformFleetOwnerCommissionRatePercent.toString()}%`,
  );

  // Only apply fleet owner commission if rate is greater than 0
  // Commission calculated on same base as platform fee (excludes security detail but includes fuel upgrade)
  const platformFleetOwnerCommissionAmount = platformFleetOwnerCommissionRatePercent.gt(0)
    ? platformFeeBase.mul(platformFleetOwnerCommissionRatePercent).div(100)
    : new Decimal(0);
  logger.debug(`Fleet Owner Commission Amount: ${platformFleetOwnerCommissionAmount.toString()}`);
  const fleetOwnerPayoutAmountNet = platformFeeBase.minus(platformFleetOwnerCommissionAmount);
  logger.debug(`Fleet Owner Payout Amount (Net): ${fleetOwnerPayoutAmountNet.toString()}`);

  // Check for referral discount eligibility and calculate discount
  let referralDiscountAmount = new Decimal(0);
  if (user?.id) {
    try {
      const eligibility = await checkReferralEligibility(
        user.id,
        subtotalBeforeDiscounts.toNumber(),
        type,
      );

      if (eligibility.eligible && eligibility.discountAmount) {
        referralDiscountAmount = new Decimal(
          Math.min(eligibility.discountAmount, subtotalBeforeDiscounts.toNumber()),
        );
        logger.debug(`Referral discount calculated: ${referralDiscountAmount.toString()}`);
      }
    } catch (error) {
      logger.error("Failed to check referral eligibility during cost calculation", { error });
      // Do not fail the calculation if referral check fails
    }
  }

  // Apply booking credits if specified
  let bookingCreditsUsed = new Decimal(0);
  if (useCredits && useCredits > 0 && user?.id) {
    try {
      const maxCredit = await calculateMaxCreditForBooking(
        user.id,
        subtotalBeforeDiscounts.toNumber(),
      );
      const actualCreditToUse = Math.min(useCredits, maxCredit);
      bookingCreditsUsed = new Decimal(actualCreditToUse);
      logger.debug(`Booking credits applied: ${bookingCreditsUsed.toString()}`);
    } catch (error) {
      logger.error("Failed to calculate booking credits", { error });
      // Do not fail the calculation if credit check fails
    }
  }

  // Calculate subtotal after discounts
  const subtotalAfterDiscounts = subtotalBeforeDiscounts
    .minus(referralDiscountAmount)
    .minus(bookingCreditsUsed);
  logger.debug(`Subtotal After Discounts: ${subtotalAfterDiscounts.toString()}`);

  // Calculate VAT on the discounted amount
  const vatRatePercent = new Decimal(vatRate.ratePercent.toString());
  logger.debug(`VAT Rate: ${vatRatePercent.toString()}%`);
  const vatAmount = subtotalAfterDiscounts.mul(vatRatePercent).div(100);
  logger.debug(`VAT Amount: ${vatAmount.toString()}`);

  // Calculate final total amount (gross)
  const finalTotalAmountWithCredits = subtotalAfterDiscounts.plus(vatAmount);
  logger.debug(`Final Total Amount (Gross): ${finalTotalAmountWithCredits.toString()}`);

  // Log the complete breakdown
  logger.debug(`Complete Calculation Breakdown:
      Net Total: ${netTotal.toString()}
      Security Detail Cost: ${securityDetailCost.toString()}
      Fuel Upgrade Cost: ${fuelUpgradeCost.toString()}
      Net Total with Security and Fuel: ${netTotalWithSecurityAndFuel.toString()}
      Platform Fee Base (Net + Fuel): ${platformFeeBase.toString()}
      Platform Service Fee (${platformCustomerServiceFeeRatePercent.toString()}%): ${platformCustomerServiceFeeAmount.toString()}
      Subtotal Before Discounts: ${subtotalBeforeDiscounts.toString()}
      Referral Discount: ${referralDiscountAmount.toString()}
      Booking Credits Used: ${bookingCreditsUsed.toString()}
      Subtotal After Discounts: ${subtotalAfterDiscounts.toString()}
      VAT (${vatRatePercent.toString()}%): ${vatAmount.toString()}
      Final Total Amount (Gross): ${finalTotalAmountWithCredits.toString()}
      Fleet Owner Commission (${platformFleetOwnerCommissionRatePercent.toString()}%): ${platformFleetOwnerCommissionAmount.toString()}
      Fleet Owner Payout (Net): ${fleetOwnerPayoutAmountNet.toString()}
    `);

  return {
    totalAmount: finalTotalAmountWithCredits,
    netTotal,
    platformCustomerServiceFeeRatePercent,
    platformCustomerServiceFeeAmount,
    subtotalBeforeVat: subtotalBeforeDiscounts, // Keep old name for compatibility
    subtotalBeforeDiscounts,
    subtotalAfterDiscounts,
    vatRatePercent,
    vatAmount,
    platformFleetOwnerCommissionRatePercent,
    platformFleetOwnerCommissionAmount,
    fleetOwnerPayoutAmountNet,
    securityDetailCost,
    fuelUpgradeCost,
    referralDiscountAmount,
    bookingCreditsUsed,
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
  car,
  user,
  useCredits,
  pickupLocation,
  returnLocation,
  specialRequests,
  paymentIntent,
  type,
  includeSecurityDetail,
  requiresFullTank,
  flightNumber,
  estimatedDuration,
}: Omit<CreateBookingParams, "paymentId" | "status" | "paymentStatus"> & {
  paymentIntent: string;
  requiresFullTank?: boolean;
  useCredits?: number;
}) {
  const bookingReference = await generateUniqueBookingReference();

  // Track referral outside of transaction for post-transaction notifications
  let didApplyReferral = false;
  let appliedReferrerUserId: string | null = null;
  let appliedDiscountAmount = 0;

  // Validate and create/link flight if flightNumber provided (for AIRPORT_PICKUP bookings)
  // Note: We validate and create the Flight record here, but only create the FlightAware alert
  // when the booking is confirmed/paid (in activateBooking)
  let flightId: string | null = null;
  if (flightNumber && type === BookingType.AIRPORT_PICKUP) {
    try {
      // Extract just the date portion (YYYY-MM-DD) for flight validation
      // The validateFlight function expects a date string, not a full ISO timestamp
      const flightDateStr = startDate.toISOString().split("T")[0];

      logger.info("Validating flight for booking", {
        flightNumber,
        flightDate: flightDateStr,
        bookingReference,
      });

      const validationResult = await validateFlight(flightNumber, flightDateStr);

      if (validationResult.type !== "success") {
        let errorMessage: string;

        if (validationResult.type === "alreadyLanded") {
          errorMessage = `Flight ${validationResult.flightNumber} already landed at ${validationResult.landedTime}`;
        } else if (validationResult.type === "notFound") {
          errorMessage = `Flight ${flightNumber} not found`;
        } else {
          errorMessage = `Flight validation error: ${validationResult.message}`;
        }

        logger.error("Flight validation failed", {
          flightNumber,
          validationType: validationResult.type,
          bookingReference,
        });
        throw new Error(errorMessage);
      }

      // Create or find existing flight record
      const flight = await findOrCreateFlight(validationResult.flight, startDate);
      flightId = flight.id;

      logger.info("Flight validated and linked to booking", {
        flightNumber,
        flightId: flight.id,
        bookingReference,
      });
    } catch (error) {
      logger.error("Failed to validate/create flight", {
        flightNumber,
        error: error instanceof Error ? error.message : String(error),
        bookingReference,
      });
      throw error;
    }
  }

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
      securityDetailCost,
      fuelUpgradeCost,
      referralDiscountAmount,
      bookingCreditsUsed,
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
      requiresFullTank,
      prismaInstance: transaction,
      user: "id" in user ? user : null,
      useCredits,
    });

    // Handle referral discount atomic reservation
    // referralDiscountAmount is already calculated in calculateBookingCost
    let referralReferrerUserId: string | null = null;
    let referralStatus: BookingReferralStatus = BookingReferralStatus.NONE;

    if ("id" in user && referralDiscountAmount.gt(0)) {
      try {
        // Check if discount is still available (don't mark as used yet)
        const userWithReferral = await transaction.user.findUnique({
          where: { id: user.id },
          select: { referralDiscountUsed: true, referredByUserId: true },
        });

        if (userWithReferral?.referralDiscountUsed) {
          logger.warn("Referral discount already used", {
            userId: user.id,
            bookingReference,
          });
          // Don't apply referral discount for this booking
        } else if (userWithReferral?.referredByUserId) {
          // Successfully validated the discount availability

          referralReferrerUserId = userWithReferral?.referredByUserId || null;
          referralStatus = BookingReferralStatus.APPLIED;
          didApplyReferral = true;
          appliedReferrerUserId = referralReferrerUserId;
          appliedDiscountAmount = referralDiscountAmount.toNumber();

          logger.info("Referral discount reserved and applied", {
            userId: user.id,
            bookingReference,
            discountAmount: referralDiscountAmount.toNumber(),
            referrerId: referralReferrerUserId,
          });
        }
      } catch (error) {
        logger.error("Failed to reserve referral discount", {
          userId: user.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Note: In production, might want to handle this by recalculating
      }
    }

    const query = {
      data: {
        bookingReference,
        startDate,
        endDate,
        carId: car.id,
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
        securityDetailCost,
        fuelUpgradeCost,
        referralDiscountAmount,
        flightNumber,
        estimatedDuration,
        flightId, // Link to Flight record if validated
        // Referral fields
        referralReferrerUserId,
        referralStatus,
        // Reserve credits at booking creation, will be moved to "used" on payment success
        referralCreditsUsed: 0,
        referralCreditsReserved: bookingCreditsUsed,
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

            // Calculate leg start and end times based on booking type
            let legStartTime: Date;
            let legEndTime: Date;

            if (type === BookingType.FULL_DAY) {
              // For FULL_DAY: each leg represents exactly 24 hours
              legStartTime = legDate; // legDate is already the start of this 24-hour period
              legEndTime = addHours(legDate, 24);
            } else if (type === BookingType.AIRPORT_PICKUP) {
              // For AIRPORT_PICKUP: use exact start and end times (preserve minutes)
              legStartTime = startDate;
              legEndTime = endDate;
            } else {
              // For DAY and NIGHT: existing logic
              legStartTime = setHours(legDate, startHours);
              legEndTime =
                endHours < startHours
                  ? setHours(addDays(legDate, 1), endHours)
                  : setHours(legDate, endHours);
            }

            return {
              legDate: type === BookingType.FULL_DAY ? legDate : setHours(legDate, 1),
              legStartTime,
              legEndTime,
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

    // Handle referral reward and user discount marking if discount was applied
    if (
      referralStatus === BookingReferralStatus.APPLIED &&
      referralReferrerUserId &&
      "id" in user
    ) {
      try {
        // Create pending reward within the same transaction
        // Use direct query to avoid transaction nesting issues
        const configResult = await transaction.referralProgramConfig.findUnique({
          where: { key: "REFERRAL_RELEASE_CONDITION" },
        });
        const releaseCondition = configResult?.value ?? "PAID";

        await transaction.referralReward.create({
          data: {
            referrerUserId: referralReferrerUserId,
            refereeUserId: user.id,
            bookingId: newBooking.id,
            amount: referralDiscountAmount,
            status: "PENDING",
            releaseCondition: releaseCondition as "PAID" | "COMPLETED",
          },
        });
        // Track pending rewards in referrer stats
        await transaction.userReferralStats.upsert({
          where: { userId: referralReferrerUserId },
          create: {
            userId: referralReferrerUserId,
            totalReferrals: 0,
            totalRewardsGranted: 0,
            totalRewardsPending: referralDiscountAmount.toNumber(),
          },
          update: { totalRewardsPending: { increment: referralDiscountAmount.toNumber() } },
        });

        // Note: User's discount will be marked as used only after successful payment in activateBooking()

        logger.info("Referral reward created", {
          bookingId: newBooking.id,
          userId: user.id,
          referrerId: referralReferrerUserId,
          rewardAmount: referralDiscountAmount.toNumber(),
        });
      } catch (error) {
        logger.error("Failed to apply referral discount after booking creation", {
          bookingId: newBooking.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't fail the booking creation if referral processing fails
      }
    }

    return newBooking;
  });

  // Send referral discount applied notification outside transaction (async, non-blocking)
  if (didApplyReferral && appliedReferrerUserId && "id" in user && car) {
    const [customerUser, referrerUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, phoneNumber: true },
      }),
      prisma.user.findUnique({
        where: { id: appliedReferrerUserId },
        select: { id: true, name: true, email: true, phoneNumber: true },
      }),
    ]);

    if (customerUser && referrerUser && booking) {
      sendReferralDiscountAppliedNotification(
        {
          id: booking.id,
          bookingReference: booking.bookingReference,
          carName: `${car.make} ${car.model}`,
          discountAmount: appliedDiscountAmount,
          originalAmount: booking.totalAmount.toNumber() + appliedDiscountAmount,
          finalAmount: booking.totalAmount.toNumber(),
        },
        customerUser,
        referrerUser,
      ).catch((error) => {
        logger.error("Failed to send referral discount applied notification", {
          error: error instanceof Error ? error.message : String(error),
          bookingId: booking.id,
          userId: user.id,
          referrerId: appliedReferrerUserId,
        });
      });
    }
  }

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
  logger.info(`Activating booking ${bookingId} with payment ID ${paymentId}`);
  const booking = await prisma.$transaction(async (transaction) => {
    // First, get the current booking to retrieve reserved credits
    const currentBooking = await transaction.booking.findUnique({
      where: { id: bookingId },
      select: {
        referralCreditsReserved: true,
      },
    });

    // Move reserved credits to used credits on payment success
    const reservedAmount = currentBooking?.referralCreditsReserved || 0;

    // Update the booking
    const booking = await transaction.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentId,
        // Move reserved credits to used
        referralCreditsUsed: reservedAmount,
        // Clear reserved credits
        referralCreditsReserved: 0,
      },
      include: {
        car: { include: { owner: true } },
        user: true,
        chauffeur: true,
        legs: { include: { extensions: true } },
      },
    });

    logger.info(`Moved ${reservedAmount} credits from reserved to used for booking ${bookingId}`);

    // Update car status to BOOKED
    await transaction.car.update({
      where: { id: booking.carId },
      data: { status: Status.BOOKED },
    });

    // Release referral reward if payment is the release condition
    try {
      const config = await getReferralConfig();
      if (
        config.REFERRAL_RELEASE_CONDITION === "PAID" &&
        booking.referralStatus === BookingReferralStatus.APPLIED
      ) {
        // For "PAID" release condition: mark discount as used immediately after payment
        if (booking.userId) {
          await transaction.user.update({
            where: { id: booking.userId },
            data: { referralDiscountUsed: true },
          });
          logger.info("Referral discount marked as used after payment", {
            bookingId: booking.id,
            userId: booking.userId,
          });
        }

        await releaseReferralReward(booking.id);
        logger.info("Referral reward released on payment", { bookingId: booking.id });
      }

      // Note: For "COMPLETED" release condition, discount should be marked as used in completeBooking()
      // However, completeBooking() is currently never called, so "COMPLETED" mode doesn't work
    } catch (error) {
      logger.error("Failed to release referral reward on payment", {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't fail the booking activation if referral processing fails
    }

    return booking;
  });

  // Create FlightAware alert if booking has a linked flight (AIRPORT_PICKUP with flight)
  // Fetch flightId and flightNumber from the booking (they're not in BookingWithRelations type)
  const bookingWithFlight = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { flightId: true, flightNumber: true },
  });

  if (bookingWithFlight?.flightId && bookingWithFlight?.flightNumber) {
    try {
      logger.info("Creating FlightAware alert for booking", {
        bookingId: booking.id,
        flightId: bookingWithFlight.flightId,
        flightNumber: bookingWithFlight.flightNumber,
      });

      // Get flight destination IATA code for the alert
      const flight = await prisma.flight.findUnique({
        where: { id: bookingWithFlight.flightId },
        select: { destinationCodeIATA: true, flightNumber: true, flightDate: true },
      });

      if (flight) {
        await getOrCreateFlightAlert(bookingWithFlight.flightId, {
          flightNumber: flight.flightNumber,
          flightDate: flight.flightDate,
          destinationIATA: flight.destinationCodeIATA || undefined,
        });

        logger.info("FlightAware alert created successfully", {
          bookingId: booking.id,
          flightId: bookingWithFlight.flightId,
        });
      }
    } catch (error) {
      logger.error("Failed to create FlightAware alert", {
        bookingId: booking.id,
        flightId: bookingWithFlight.flightId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the booking activation if alert creation fails
    }
  }

  return booking;
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
  car: { dayRate: number; nightRate: number; hourlyRate: number; fullDayRate: number; airportPickupRate: number },
  booking: { startDate: Date; endDate: Date; type: BookingType },
  legDate: Date,
): number {
  const { dayRate, nightRate, fullDayRate, airportPickupRate } = car;
  const { type } = booking;

  if (type === BookingType.NIGHT) {
    // For NIGHT bookings, charge the flat nightRate for any leg.
    // This assumes a night booking covers a period that falls on this legDate.
    return nightRate;
  }

  if (type === BookingType.FULL_DAY) {
    // For FULL_DAY bookings, always charge the flat fullDayRate for any leg.
    // Each leg represents a full 24-hour period.
    return fullDayRate;
  }

  if (type === BookingType.AIRPORT_PICKUP) {
    // For AIRPORT_PICKUP bookings, charge the flat airportPickupRate
    // This is a one-time fee for airport pickup service including flight tracking
    return airportPickupRate;
  }

  // BookingType.DAY calculations
  // For DAY bookings, always charge the flat dayRate per leg (12-hour period)
  // Hourly rate is only used for booking extensions, not for regular bookings
  return dayRate;
}

export async function cancelBooking(bookingId: string, reason: string) {
  const booking = await prisma.$transaction(async (transaction) => {
    // First fetch the booking to check its current payment status
    const existingBooking = await transaction.booking.findUnique({
      where: { id: bookingId },
      select: { paymentStatus: true },
    });

    const booking = await transaction.booking.update({
      where: {
        id: bookingId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
      data: {
        status: BookingStatus.CANCELLED,
        // Only mark as REFUNDED if it was actually PAID, otherwise keep original status
        paymentStatus:
          existingBooking?.paymentStatus === PaymentStatus.PAID
            ? PaymentStatus.REFUNDED
            : existingBooking?.paymentStatus || PaymentStatus.UNPAID,
        cancelledAt: new Date(),
        cancellationReason: reason,
        // Clear reserved credits and used credits on cancellation
        referralCreditsReserved: 0,
        // If booking was paid and is now refunded, clear used credits too
        referralCreditsUsed: existingBooking?.paymentStatus === PaymentStatus.PAID ? 0 : undefined,
      },
      include: {
        user: true,
        chauffeur: true,
        legs: { include: { extensions: true } },
        car: { include: { owner: { include: { chauffeurs: true } } } },
      },
    });

    // Free up the car
    await transaction.car.update({
      where: { id: booking.carId },
      data: { status: Status.AVAILABLE },
    });

    // Handle referral reversal if applicable
    if (booking.referralStatus === BookingReferralStatus.APPLIED && booking.userId) {
      try {
        // Find the referral reward
        const reward = await transaction.referralReward.findFirst({
          where: { bookingId: booking.id },
        });

        if (reward) {
          if (reward.status === "RELEASED") {
            // Reverse the reward
            await transaction.referralReward.update({
              where: { id: reward.id },
              data: {
                status: "REVERSED",
                reason: `Booking cancelled: ${reason}`,
              },
            });

            // Update referrer stats
            await transaction.userReferralStats.update({
              where: { userId: reward.referrerUserId },
              data: {
                totalRewardsGranted: { decrement: reward.amount },
              },
            });

            logger.info("Referral reward reversed due to cancellation", {
              bookingId: booking.id,
              rewardId: reward.id,
              amount: reward.amount,
            });
          } else if (reward.status === "PENDING") {
            // Cancel the pending reward
            await transaction.referralReward.update({
              where: { id: reward.id },
              data: {
                status: "REVERSED",
                reason: `Booking cancelled before reward release: ${reason}`,
              },
            });

            // Give user back their referral discount eligibility
            await transaction.user.update({
              where: { id: booking.userId },
              data: { referralDiscountUsed: false },
            });

            logger.info("Pending referral reward cancelled, discount eligibility restored", {
              bookingId: booking.id,
              userId: booking.userId,
            });
          }
        }

        // Update booking referral status
        await transaction.booking.update({
          where: { id: booking.id },
          data: { referralStatus: BookingReferralStatus.REVERSED },
        });
      } catch (error) {
        logger.error("Failed to handle referral reversal on cancellation", {
          bookingId: booking.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't fail the cancellation if referral processing fails
      }
    }

    return booking;
  });

  // Disable FlightAware alert if booking had a linked flight
  const bookingWithFlight = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { flightId: true, flight: { select: { alertId: true } } },
  });

  if (bookingWithFlight?.flightId && bookingWithFlight?.flight?.alertId) {
    try {
      logger.info("Disabling FlightAware alert for cancelled booking", {
        bookingId,
        flightId: bookingWithFlight.flightId,
        alertId: bookingWithFlight.flight.alertId,
      });

      // Check if there are other active bookings using this flight
      const otherActiveBookings = await prisma.booking.count({
        where: {
          flightId: bookingWithFlight.flightId,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
          id: { not: bookingId },
        },
      });

      // Only disable the alert if no other bookings are using it
      if (otherActiveBookings === 0) {
        await disableFlightAlert(bookingWithFlight.flight.alertId);
        await disableFlightAlertTracking(bookingWithFlight.flightId);

        logger.info("FlightAware alert disabled (no other active bookings)", {
          bookingId,
          flightId: bookingWithFlight.flightId,
        });
      } else {
        logger.info("FlightAware alert kept active (other bookings exist)", {
          bookingId,
          flightId: bookingWithFlight.flightId,
          otherActiveBookings,
        });
      }
    } catch (error) {
      logger.error("Failed to disable FlightAware alert", {
        bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the cancellation if alert cleanup fails
    }
  }

  return booking;
}

// Complete a booking and release referral rewards if condition is "COMPLETED"
export async function completeBooking(bookingId: string) {
  return prisma.$transaction(async (transaction) => {
    const booking = await transaction.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
      include: {
        user: true,
        car: { include: { owner: true } },
      },
    });

    // Process all referral conditions when booking is completed
    try {
      // Step 1: Get referral configuration to determine when rewards should be released
      const config = await getReferralConfig();

      // Step 2: Check if referral system is enabled globally
      if (!config.REFERRAL_ENABLED) {
        logger.info("Referral system disabled, skipping referral processing", {
          bookingId: booking.id,
        });
        return booking;
      }

      // Step 3: Check if this booking should trigger referral processing
      const shouldProcessReferral =
        config.REFERRAL_RELEASE_CONDITION === "COMPLETED" &&
        booking.referralStatus === BookingReferralStatus.APPLIED &&
        booking.userId &&
        booking.referralReferrerUserId;

      if (!shouldProcessReferral) {
        logger.info("No referral processing needed for this booking", {
          bookingId: booking.id,
          releaseCondition: config.REFERRAL_RELEASE_CONDITION,
          referralStatus: booking.referralStatus,
        });
        return booking;
      }

      logger.info("Processing referral completion for booking", {
        bookingId: booking.id,
        userId: booking.userId,
        referrerId: booking.referralReferrerUserId,
        discountAmount: booking.referralDiscountAmount,
      });

      // Step 4: Check for idempotency - prevent double-processing
      const existingReleasedReward = await transaction.referralReward.findFirst({
        where: {
          bookingId: booking.id,
          status: "RELEASED",
        },
      });

      if (existingReleasedReward) {
        logger.warn("Referral reward already released for this booking", {
          bookingId: booking.id,
          rewardId: existingReleasedReward.id,
        });
        return booking;
      }

      // Step 5: Validate that the user hasn't already used their discount elsewhere
      const userReferralInfo = await transaction.user.findUnique({
        where: { id: booking.userId! },
        select: {
          referralDiscountUsed: true,
          referralSignupAt: true,
          referredByUserId: true,
        },
      });

      // Step 6: Check referral expiry if configured
      if (config.REFERRAL_EXPIRY_DAYS > 0 && userReferralInfo?.referralSignupAt) {
        const daysSinceSignup = Math.floor(
          (Date.now() - userReferralInfo.referralSignupAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceSignup > config.REFERRAL_EXPIRY_DAYS) {
          logger.warn("Referral has expired, not processing reward", {
            bookingId: booking.id,
            userId: booking.userId,
            daysSinceSignup,
            expiryDays: config.REFERRAL_EXPIRY_DAYS,
          });
          return booking;
        }
      }

      // Step 7: Mark the referee's one-time discount as permanently used
      // This should only happen once when the service is successfully completed
      if (!userReferralInfo?.referralDiscountUsed) {
        await transaction.user.update({
          where: { id: booking.userId! },
          data: { referralDiscountUsed: true },
        });

        logger.info("Referral discount marked as used after service completion", {
          bookingId: booking.id,
          userId: booking.userId,
          discountAmount: booking.referralDiscountAmount,
        });
      } else {
        logger.warn("User's referral discount was already marked as used", {
          bookingId: booking.id,
          userId: booking.userId,
        });
      }

      // Step 8: Release the referral reward (this handles the referrer's reward)
      // This function updates the reward status from PENDING -> RELEASED
      const releasedReward = await releaseReferralReward(booking.id);

      if (releasedReward) {
        logger.info("Referral reward successfully released on completion", {
          bookingId: booking.id,
          rewardId: releasedReward.id,
          rewardAmount: releasedReward.amount,
          referrerId: releasedReward.referrerUserId,
        });

        // Step 9: Update booking referral status to indicate reward has been processed
        await transaction.booking.update({
          where: { id: booking.id },
          data: { referralStatus: BookingReferralStatus.REWARDED },
        });

        // Step 10: Send notification to referrer about their earned reward
        try {
          const referrer = await transaction.user.findUnique({
            where: { id: booking.referralReferrerUserId! },
            select: { email: true, name: true },
          });

          const referee = await transaction.user.findUnique({
            where: { id: booking.userId! },
            select: { name: true, email: true },
          });

          if (referrer && referee) {
            await sendReferralRewardEarnedNotification(
              {
                id: releasedReward.id,
                amount: Number(releasedReward.amount),
                bookingReference: booking.bookingReference,
              },
              {
                id: booking.referralReferrerUserId!,
                name: referrer.name,
                email: referrer.email,
              },
              {
                id: booking.userId!,
                name: referee.name,
                email: referee.email,
              },
            );

            logger.info("Referral reward notification sent", {
              bookingId: booking.id,
              referrerEmail: referrer.email,
              rewardAmount: releasedReward.amount,
            });
          }
        } catch (notificationError) {
          logger.error("Failed to send referral reward notification", {
            bookingId: booking.id,
            error: notificationError instanceof Error ? notificationError.message : "Unknown error",
          });
          // Don't fail the completion if notification fails
        }
      } else {
        logger.warn("No referral reward was released - may have already been processed", {
          bookingId: booking.id,
        });
      }

      // Step 11: Log completion for audit trail
      logger.info("Referral completion processing finished successfully", {
        bookingId: booking.id,
        userId: booking.userId,
        referrerId: booking.referralReferrerUserId,
        rewardReleased: !!releasedReward,
        discountMarkedAsUsed: true,
      });
    } catch (error) {
      logger.error("Failed to process referral completion", {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Don't fail the entire booking completion if referral processing fails
      // This ensures booking completion isn't blocked by referral issues
    }

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
    orderBy: { startDate: "asc" },
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

export async function getBooking(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        car: { include: { owner: { include: { chauffeurs: true } } } },
        chauffeur: true,
        user: true,
        legs: { include: { extensions: true } },
      },
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

  if (bookings.length === 0) {
    return null;
  }

  const serializedBookings = bookings.map((booking) => ({
    ...booking,
    totalAmount: booking.totalAmount?.toNumber() ?? 0,
    netTotal: booking.netTotal?.toNumber() ?? 0,
    vatAmount: booking.vatAmount?.toNumber() ?? 0,
    platformCustomerServiceFeeAmount: booking.platformCustomerServiceFeeAmount?.toNumber() ?? 0,
    fuelUpgradeCost: booking.fuelUpgradeCost?.toNumber() ?? 0,
    securityDetailCost: booking.securityDetailCost?.toNumber() ?? 0,
  }));

  return serializedBookings.reduce(
    (acc, booking) => {
      const status = booking.status;

      if (!acc[status]) {
        acc[status] = [];
      }

      acc[status].push(booking);
      // Sort bookings by date/time, most recent first
      // acc[status].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      return acc;
    },
    {} as Record<keyof typeof BookingStatus, typeof serializedBookings>,
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
