import {
  Booking,
  BookingType,
  Car,
  BookingStatus,
  Status as CarStatus,
  CarApprovalStatus,
  PaymentStatus,
  BookingReferralStatus,
  Prisma,
} from "@prisma/client";

/**
 * Creates a test Car object with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function makeCar(overrides: Partial<Car> = {}): Car {
  return {
    id: "car-default",
    make: "Toyota",
    model: "Camry",
    year: 2020,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    color: "black",
    ownerId: "owner-1",
    registrationNumber: "ABC-123",
    status: CarStatus.AVAILABLE,
    approvalStatus: CarApprovalStatus.APPROVED,
    approvalNotes: null,
    hourlyRate: 1000,
    dayRate: 5000,
    nightRate: 3000,
    fuelUpgradeRate: 0,
    fullDayRate: 10000,
    ...overrides,
  };
}

/**
 * Creates a test Booking object with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-default",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    status: BookingStatus.PENDING,
    startDate: new Date("2025-01-02T07:00:00.000Z"),
    endDate: new Date("2025-01-02T19:00:00.000Z"),
    totalAmount: new Prisma.Decimal(0),
    paymentStatus: PaymentStatus.UNPAID,
    paymentId: null,
    carId: "car-default",
    userId: null,
    pickupLocation: "",
    returnLocation: "",
    specialRequests: null,
    chauffeurId: null,
    cancelledAt: null,
    cancellationReason: null,
    guestUser: null,
    type: BookingType.DAY,
    paymentIntent: null,
    fleetOwnerPayoutAmountNet: null,
    netTotal: null,
    overallPayoutStatus: null,
    platformCustomerServiceFeeAmount: null,
    platformCustomerServiceFeeRatePercent: null,
    platformFleetOwnerCommissionAmount: null,
    platformFleetOwnerCommissionRatePercent: null,
    subtotalBeforeVat: null,
    vatAmount: null,
    vatRatePercent: null,
    bookingReference: "REF-TEST",
    securityDetailCost: null,
    fuelUpgradeCost: null,
    referralReferrerUserId: null,
    referralDiscountAmount: new Prisma.Decimal(0),
    referralStatus: BookingReferralStatus.NONE,
    referralCreditsUsed: new Prisma.Decimal(0),
    referralCreditsReserved: new Prisma.Decimal(0),
    ...overrides,
  };
}
