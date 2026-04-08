import {
  AddonType,
  CarApprovalStatus,
  DocumentStatus,
  DocumentType,
  FleetOwnerStatus,
  PlatformFeeType,
  ServiceTier,
  Status,
  VehicleType,
} from "@prisma/client";
import { isE2ETesting } from "~/modules/auth/otp-test-store.server";
import { prisma } from "~/modules/db/db.server";

const E2E_FLEET_OWNER_EMAIL = "e2e-fleet-owner@test.tripdly.com";
const E2E_CHAUFFEUR_EMAIL = "e2e-chauffeur@test.tripdly.com";

const E2E_CAR = {
  make: "Toyota",
  model: "Land Cruiser 300",
  year: 2024,
  color: "Black",
  registrationNumber: "LAG 200 E2E",
  vehicleType: VehicleType.SUV,
  serviceTier: ServiceTier.LUXURY,
  passengerCapacity: 7,
  dayRate: 25_000,
  fullDayRate: 50_000,
  nightRate: 15_000,
  hourlyRate: 5_000,
  airportPickupRate: 20_000,
  fuelUpgradeRate: 2_000,
  pricingIncludesFuel: true,
  status: Status.AVAILABLE,
  approvalStatus: CarApprovalStatus.APPROVED,
};

/**
 * POST /api/test/seed-car
 *
 * Ensures a deterministic car with known pricing exists in the DB,
 * along with all supporting data (fleet owner, chauffeur, rates,
 * referral config). Returns the car details for test assertions.
 *
 * Only available when E2E_TESTING=true.
 */
export async function action() {
  if (!isE2ETesting() || process.env.NODE_ENV === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const fleetOwnerCanonical = {
    email: E2E_FLEET_OWNER_EMAIL,
    username: "e2e-fleet-owner",
    name: "E2E Fleet Owner",
    fleetOwnerStatus: FleetOwnerStatus.APPROVED,
    hasOnboarded: true,
  };

  const chauffeurCanonical = {
    email: E2E_CHAUFFEUR_EMAIL,
    username: "e2e-chauffeur",
    name: "E2E Chauffeur",
    phoneNumber: "+2348000000001",
  };

  const car = await prisma.$transaction(async (tx) => {
    // (1) Reset fleet owner + chauffeur to canonical values.
    const fleetOwner = await tx.user.upsert({
      where: { email: E2E_FLEET_OWNER_EMAIL },
      update: {
        username: fleetOwnerCanonical.username,
        name: fleetOwnerCanonical.name,
        fleetOwnerStatus: fleetOwnerCanonical.fleetOwnerStatus,
        hasOnboarded: fleetOwnerCanonical.hasOnboarded,
        roles: {
          connectOrCreate: {
            where: { name: "fleetOwner" },
            create: { name: "fleetOwner", description: "Fleet owner" },
          },
        },
      },
      create: {
        ...fleetOwnerCanonical,
        roles: {
          connectOrCreate: {
            where: { name: "fleetOwner" },
            create: { name: "fleetOwner", description: "Fleet owner" },
          },
        },
      },
      select: { id: true },
    });

    const chauffeur = await tx.user.upsert({
      where: { email: E2E_CHAUFFEUR_EMAIL },
      update: {
        username: chauffeurCanonical.username,
        name: chauffeurCanonical.name,
        phoneNumber: chauffeurCanonical.phoneNumber,
        fleetOwnerId: fleetOwner.id,
        roles: {
          connectOrCreate: {
            where: { name: "chauffeur" },
            create: { name: "chauffeur", description: "Chauffeur" },
          },
        },
      },
      create: {
        ...chauffeurCanonical,
        fleetOwnerId: fleetOwner.id,
        roles: {
          connectOrCreate: {
            where: { name: "chauffeur" },
            create: { name: "chauffeur", description: "Chauffeur" },
          },
        },
      },
      select: { id: true },
    });

    // (2) Remove existing approvals for chauffeur and car.
    await tx.documentApproval.deleteMany({
      where: { userId: chauffeur.id },
    });

    const existingCar = await tx.car.findFirst({
      where: { registrationNumber: E2E_CAR.registrationNumber },
      select: { id: true },
    });

    if (existingCar) {
      await tx.documentApproval.deleteMany({
        where: { carId: existingCar.id },
      });
    }

    // (4) Upsert/reset car to canonical values.
    const seededCar = existingCar
      ? await tx.car.update({
          where: { id: existingCar.id },
          data: { ...E2E_CAR, ownerId: fleetOwner.id },
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            dayRate: true,
            pricingIncludesFuel: true,
          },
        })
      : await tx.car.create({
          data: { ...E2E_CAR, ownerId: fleetOwner.id },
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            dayRate: true,
            pricingIncludesFuel: true,
          },
        });

    // (3) Recreate canonical approved docs for chauffeur and car.
    await tx.documentApproval.createMany({
      data: [
        {
          documentType: DocumentType.NIN,
          documentUrl: "e2e-placeholder",
          status: DocumentStatus.APPROVED,
          userId: chauffeur.id,
        },
        {
          documentType: DocumentType.DRIVERS_LICENSE,
          documentUrl: "e2e-placeholder",
          status: DocumentStatus.APPROVED,
          userId: chauffeur.id,
        },
        {
          documentType: DocumentType.MOT_CERTIFICATE,
          documentUrl: "e2e-placeholder",
          carId: seededCar.id,
          status: DocumentStatus.APPROVED,
        },
        {
          documentType: DocumentType.INSURANCE_CERTIFICATE,
          documentUrl: "e2e-placeholder",
          carId: seededCar.id,
          status: DocumentStatus.APPROVED,
        },
      ],
    });

    return seededCar;
  });

  // --- Rates (upsert-safe) ---
  const now = new Date();

  const existingVat = await prisma.taxRate.findFirst({
    where: {
      effectiveSince: { lte: now },
      OR: [{ effectiveUntil: { gt: now } }, { effectiveUntil: null }],
    },
  });
  if (!existingVat) {
    await prisma.taxRate.create({
      data: { ratePercent: 7.5, effectiveSince: now, description: "VAT" },
    });
  }

  const existingPlatformFee = await prisma.platformFeeRate.findFirst({
    where: {
      feeType: PlatformFeeType.PLATFORM_SERVICE_FEE,
      effectiveSince: { lte: now },
      OR: [{ effectiveUntil: { gt: now } }, { effectiveUntil: null }],
    },
  });
  if (!existingPlatformFee) {
    await prisma.platformFeeRate.create({
      data: {
        feeType: PlatformFeeType.PLATFORM_SERVICE_FEE,
        ratePercent: 0,
        effectiveSince: now,
        description: "Platform service fee",
      },
    });
  }

  const existingCommission = await prisma.platformFeeRate.findFirst({
    where: {
      feeType: PlatformFeeType.FLEET_OWNER_COMMISSION,
      effectiveSince: { lte: now },
      OR: [{ effectiveUntil: { gt: now } }, { effectiveUntil: null }],
    },
  });
  if (!existingCommission) {
    await prisma.platformFeeRate.create({
      data: {
        feeType: PlatformFeeType.FLEET_OWNER_COMMISSION,
        ratePercent: 0,
        effectiveSince: now,
        description: "Fleet owner commission",
      },
    });
  }

  const existingAddon = await prisma.addonRate.findFirst({
    where: {
      addonType: AddonType.SECURITY_DETAIL,
      effectiveSince: { lte: now },
      OR: [{ effectiveUntil: { gt: now } }, { effectiveUntil: null }],
    },
  });
  if (!existingAddon) {
    await prisma.addonRate.create({
      data: {
        addonType: AddonType.SECURITY_DETAIL,
        rateAmount: 30_000,
        effectiveSince: now,
        description: "Security detail",
      },
    });
  }

  // --- Referral program config ---
  const referralDefaults = [
    { key: "REFERRAL_ENABLED", value: true },
    { key: "REFERRAL_DISCOUNT_AMOUNT", value: 10_000 },
    { key: "REFERRAL_MIN_BOOKING_AMOUNT", value: 20_000 },
    { key: "REFERRAL_ELIGIBLE_TYPES", value: ["DAY", "NIGHT", "FULL_DAY"] },
    { key: "REFERRAL_RELEASE_CONDITION", value: "PAID" },
    { key: "REFERRAL_EXPIRY_DAYS", value: 30 },
    { key: "REFERRAL_MAX_CREDITS_PER_BOOKING", value: 30_000 },
  ];

  for (const cfg of referralDefaults) {
    await prisma.referralProgramConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value, updatedAt: now },
      create: { key: cfg.key, value: cfg.value, updatedAt: now },
    });
  }

  // --- Roles needed for test users ---
  await prisma.role.upsert({
    where: { name: "user" },
    update: {},
    create: { name: "user", description: "Regular user" },
  });

  const vatRate = await prisma.taxRate.findFirst({
    where: {
      effectiveSince: { lte: now },
      OR: [{ effectiveUntil: { gt: now } }, { effectiveUntil: null }],
    },
    select: { ratePercent: true },
  });

  const platformFee = await prisma.platformFeeRate.findFirst({
    where: {
      feeType: PlatformFeeType.PLATFORM_SERVICE_FEE,
      effectiveSince: { lte: now },
      OR: [{ effectiveUntil: { gt: now } }, { effectiveUntil: null }],
    },
    select: { ratePercent: true },
  });

  const referralDiscount = await prisma.referralProgramConfig.findUnique({
    where: { key: "REFERRAL_DISCOUNT_AMOUNT" },
    select: { value: true },
  });

  const referralMinBooking = await prisma.referralProgramConfig.findUnique({
    where: { key: "REFERRAL_MIN_BOOKING_AMOUNT" },
    select: { value: true },
  });

  return Response.json({
    car: {
      id: car.id,
      make: car.make,
      model: car.model,
      year: car.year,
      dayRate: car.dayRate,
      pricingIncludesFuel: car.pricingIncludesFuel,
    },
    rates: {
      vatRatePercent: vatRate ? Number(vatRate.ratePercent) : 7.5,
      platformFeeRatePercent: platformFee ? Number(platformFee.ratePercent) : 0,
    },
    referralConfig: {
      discountAmount: referralDiscount ? Number(referralDiscount.value) : 10_000,
      minBookingAmount: referralMinBooking ? Number(referralMinBooking.value) : 20_000,
    },
  });
}
