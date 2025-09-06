import { prisma } from "~/modules/db/db.server";
import { PaymentStatus } from "@prisma/client";
import logger from "~/lib/logger.server";
import Decimal from "decimal.js";

// Simple in-memory cache for rates (since they change infrequently)
const ratesCache: {
  data: {
    platformCustomerServiceFeeRatePercent: Decimal;
    platformFleetOwnerCommissionRatePercent: Decimal;
    vatRatePercent: Decimal;
    securityDetailRate: Decimal;
  } | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const RATES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Activate an extension after payment is confirmed
export async function activateExtension(extensionId: string, paymentId: string) {
  const extension = await prisma.$transaction(async (transaction) => {
    const extension = await transaction.extension.update({
      where: { id: extensionId },
      data: {
        paymentId,
        status: "ACTIVE",
        paymentStatus: PaymentStatus.PAID,
      },
      include: {
        bookingLeg: {
          include: { booking: { include: { car: { include: { owner: true } }, user: true } } },
        },
      },
    });

    await transaction.bookingLeg.update({
      where: { id: extension.bookingLeg.id },
      data: {
        legEndTime: extension.extensionEndTime,
      },
    });

    return extension;
  });

  logger.debug("Activated extension:", extension);

  return extension;
}

// Find an extension by payment intent
export async function findExtensionByPaymentIntent(paymentIntent: string) {
  return prisma.extension.findFirst({
    where: { paymentIntent },
    include: { bookingLeg: { include: { booking: { include: { car: true, user: true } } } } },
  });
}

export async function getExtension(extensionId: string) {
  return prisma.extension.findUnique({
    where: { id: extensionId },
    include: { bookingLeg: { include: { booking: true } } },
  });
}

export async function getBookingExtensions(bookingLegId: string) {
  return prisma.extension.findMany({
    where: { bookingLegId },
    orderBy: { createdAt: "asc" },
  });
}

// Clean up abandoned pending extensions
export async function cleanupPendingExtensions(olderThan: Date) {
  return prisma.extension.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: olderThan },
    },
    data: {
      status: "CANCELLED",
    },
  });
}

// Calculate extension financials
export async function calculateExtensionFinancials(
  rate: number,
  hours: number,
  platformCustomerServiceFeeRatePercent: Decimal,
  platformFleetOwnerCommissionRatePercent: Decimal,
  vatRatePercent: Decimal,
) {
  // Calculate net total (base price for the extension)
  const netTotal = new Decimal(rate).mul(hours);
  logger.debug(`Net Total (base price): ${netTotal.toString()}`);

  // Calculate platform service fee
  // const platformCustomerServiceFeeRatePercent = platformFeeRate;
  logger.debug(`Platform Service Fee Rate: ${platformCustomerServiceFeeRatePercent.toString()}%`);

  // Only apply platform service fee if the fee percent is greater than 0
  const platformCustomerServiceFeeAmount = netTotal
    .mul(Decimal.max(platformCustomerServiceFeeRatePercent, new Decimal(0)))
    .div(100);
  logger.debug(`Platform Service Fee Amount: ${platformCustomerServiceFeeAmount.toString()}`);

  // Calculate subtotal before VAT
  const subtotalBeforeVat = netTotal.plus(platformCustomerServiceFeeAmount);
  logger.debug(`Subtotal Before VAT: ${subtotalBeforeVat.toString()}`);

  // Calculate VAT
  logger.debug(`VAT Rate: ${vatRatePercent.toString()}%`);
  const vatAmount = subtotalBeforeVat.mul(vatRatePercent).div(100);
  logger.debug(`VAT Amount: ${vatAmount.toString()}`);

  // Calculate total amount (gross)
  const totalAmount = subtotalBeforeVat.plus(vatAmount);
  logger.debug(`Total Amount (Gross): ${totalAmount.toString()}`);

  // Calculate fleet owner commission and payout
  logger.debug(
    `Fleet Owner Commission Rate: ${platformFleetOwnerCommissionRatePercent.toString()}%`,
  );

  // Only apply fleet owner commission if rate is greater than 0
  const platformFleetOwnerCommissionAmount = platformFleetOwnerCommissionRatePercent.gt(0)
    ? netTotal.mul(platformFleetOwnerCommissionRatePercent).div(100)
    : new Decimal(0);
  logger.debug(`Fleet Owner Commission Amount: ${platformFleetOwnerCommissionAmount.toString()}`);
  const fleetOwnerPayoutAmountNet = netTotal.minus(platformFleetOwnerCommissionAmount);
  logger.debug(`Fleet Owner Payout Amount (Net): ${fleetOwnerPayoutAmountNet.toString()}`);

  // Log the complete breakdown
  logger.debug(`Complete Extension Calculation Breakdown:
    Net Total: ${netTotal.toString()}
    Platform Service Fee (${platformCustomerServiceFeeRatePercent.toString()}%): ${platformCustomerServiceFeeAmount.toString()}
    Subtotal Before VAT: ${subtotalBeforeVat.toString()}
    VAT (${vatRatePercent.toString()}%): ${vatAmount.toString()}
    Total Amount (Gross): ${totalAmount.toString()}
    Fleet Owner Commission (${platformFleetOwnerCommissionRatePercent.toString()}%): ${platformFleetOwnerCommissionAmount.toString()}
    Fleet Owner Payout (Net): ${fleetOwnerPayoutAmountNet.toString()}
  `);

  return {
    netTotal,
    platformCustomerServiceFeeRatePercent,
    platformCustomerServiceFeeAmount,
    subtotalBeforeVat,
    vatRatePercent,
    vatAmount,
    platformFleetOwnerCommissionRatePercent,
    platformFleetOwnerCommissionAmount,
    fleetOwnerPayoutAmountNet,
    totalAmount,
  };
}

export async function getRates() {
  const now = Date.now();

  // Check if we have cached data that's still valid
  if (ratesCache.data && now - ratesCache.timestamp < RATES_CACHE_TTL) {
    return ratesCache.data;
  }

  const currentDate = new Date();

  // Run all rate queries in parallel for better performance
  const [platformRates, vatRate, securityDetailAddonRate] = await Promise.all([
    // Get both platform fee rates in a single query
    prisma.platformFeeRate.findMany({
      where: {
        feeType: { in: ["PLATFORM_SERVICE_FEE", "FLEET_OWNER_COMMISSION"] },
        effectiveSince: { lte: currentDate },
        OR: [{ effectiveUntil: { gt: currentDate } }, { effectiveUntil: null }],
      },
      orderBy: { effectiveSince: "desc" },
    }),
    // Get VAT rate
    prisma.taxRate.findFirst({
      where: {
        effectiveSince: { lte: currentDate },
        OR: [{ effectiveUntil: { gt: currentDate } }, { effectiveUntil: null }],
      },
      orderBy: { effectiveSince: "desc" },
    }),
    // Get security detail addon rate
    prisma.addonRate.findFirst({
      where: {
        addonType: "SECURITY_DETAIL",
        effectiveSince: { lte: currentDate },
        OR: [{ effectiveUntil: { gt: currentDate } }, { effectiveUntil: null }],
      },
      orderBy: { effectiveSince: "desc" },
    }),
  ]);

  // Extract the specific rates from the array
  const platformFeeRate = platformRates.find((rate) => rate.feeType === "PLATFORM_SERVICE_FEE");
  const fleetOwnerCommissionRate = platformRates.find(
    (rate) => rate.feeType === "FLEET_OWNER_COMMISSION",
  );

  if (!platformFeeRate) {
    throw new Error("No active platform service fee rate found");
  }

  if (!fleetOwnerCommissionRate) {
    throw new Error("No active fleet owner commission rate found");
  }

  if (!vatRate) {
    throw new Error("No active VAT rate found");
  }

  if (!securityDetailAddonRate) {
    throw new Error("No active security detail rate found");
  }

  const result = {
    platformCustomerServiceFeeRatePercent: platformFeeRate.ratePercent,
    platformFleetOwnerCommissionRatePercent: fleetOwnerCommissionRate.ratePercent,
    vatRatePercent: vatRate.ratePercent,
    securityDetailRate: securityDetailAddonRate.rateAmount,
  };

  // Cache the result
  ratesCache.data = result;
  ratesCache.timestamp = now;

  return result;
}
