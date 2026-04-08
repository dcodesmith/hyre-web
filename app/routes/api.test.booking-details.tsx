import type { LoaderFunctionArgs } from "react-router";
import { isE2ETesting } from "~/modules/auth/otp-test-store.server";
import { prisma } from "~/modules/db/db.server";

/**
 * GET /api/test/booking-details?bookingId=...
 *
 * Returns the booking's full financial record from the database,
 * plus the associated car's pricing. Used by E2E tests to assert
 * that UI values match the persisted DB state.
 *
 * Only available when E2E_TESTING=true.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (!isE2ETesting()) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");

  if (!bookingId) {
    return Response.json({ error: "bookingId query param is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      type: true,
      startDate: true,
      endDate: true,
      totalAmount: true,
      subtotalBeforeVat: true,
      vatAmount: true,
      vatRatePercent: true,
      fuelUpgradeCost: true,
      referralDiscountAmount: true,
      referralCreditsUsed: true,
      referralStatus: true,
      platformCustomerServiceFeeAmount: true,
      platformCustomerServiceFeeRatePercent: true,
      netTotal: true,
      paymentStatus: true,
      car: {
        select: {
          id: true,
          make: true,
          model: true,
          dayRate: true,
          nightRate: true,
          fullDayRate: true,
          airportPickupRate: true,
          hourlyRate: true,
          fuelUpgradeRate: true,
          pricingIncludesFuel: true,
        },
      },
    },
  });

  if (!booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  const toNum = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return Response.json({
    booking: {
      id: booking.id,
      status: booking.status,
      type: booking.type,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalAmount: toNum(booking.totalAmount),
      subtotalBeforeVat: toNum(booking.subtotalBeforeVat),
      vatAmount: toNum(booking.vatAmount),
      vatRatePercent: toNum(booking.vatRatePercent),
      fuelUpgradeCost: toNum(booking.fuelUpgradeCost),
      referralDiscountAmount: toNum(booking.referralDiscountAmount),
      referralCreditsUsed: toNum(booking.referralCreditsUsed),
      referralStatus: booking.referralStatus,
      platformFeeAmount: toNum(booking.platformCustomerServiceFeeAmount),
      platformFeeRatePercent: toNum(booking.platformCustomerServiceFeeRatePercent),
      netTotal: toNum(booking.netTotal),
      paymentStatus: booking.paymentStatus,
    },
    car: {
      id: booking.car.id,
      make: booking.car.make,
      model: booking.car.model,
      dayRate: booking.car.dayRate,
      nightRate: booking.car.nightRate,
      fullDayRate: booking.car.fullDayRate,
      airportPickupRate: booking.car.airportPickupRate,
      hourlyRate: booking.car.hourlyRate,
      fuelUpgradeRate: booking.car.fuelUpgradeRate,
      pricingIncludesFuel: booking.car.pricingIncludesFuel,
    },
  });
}
