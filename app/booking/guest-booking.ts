import type { BookingDetail, GuestBookingDetail } from "~/api/bookings/schema";

export function guestBookingAsDetail(booking: GuestBookingDetail): BookingDetail {
  return {
    id: booking.bookingId,
    bookingReference: booking.bookingReference,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    type: booking.bookingType,
    startDate: booking.startDate,
    endDate: booking.endDate,
    pickupLocation: booking.pickupLocation,
    returnLocation: booking.returnLocation,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    netTotal: null,
    platformCustomerServiceFeeAmount: null,
    platformCustomerServiceFeeRatePercent: null,
    vatAmount: null,
    vatRatePercent: null,
    securityDetailCost: null,
    fuelUpgradeCost: null,
    referralDiscountAmount: null,
    referralCreditsUsed: null,
    car: booking.car,
    chauffeur: booking.chauffeur,
    flight: null,
    legs: booking.legs.map((leg) => ({
      ...leg,
      extensions: leg.extensions.map((extension) => ({
        id: extension.id,
        status: extension.status,
        paymentStatus: extension.paymentStatus,
        extendedDurationHours: extension.extendedDurationHours,
        netTotal: null,
      })),
      canExtend: false,
      maxExtendableHours: 0,
    })),
    canEdit: false,
    canCancel: false,
    modificationCutoffAt: booking.startDate,
  };
}
