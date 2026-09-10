import { useSearchParams } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { FleetCarOnboardingPage } from "~/fleet/cars/fleet-car-onboarding-page";

const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";

const fixtureCar = {
  id: "cm12345678901234567890123",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
  registrationNumber: "KJA123AB",
  status: "HOLD",
  approvalStatus: "PENDING",
  approvalNotes: null,
  submittedAt: null,
  hourlyRate: null,
  dayRate: null,
  nightRate: null,
  fuelUpgradeRate: null,
  fullDayRate: null,
  airportPickupRate: null,
  vehicleType: "SEDAN",
  serviceTier: "STANDARD",
  passengerCapacity: 5,
  pricingIncludesFuel: false,
  owner: {
    id: "owner-1",
    name: "Ada Lovelace",
    username: null,
    email: "owner@example.com",
  },
  images: [],
  documents: [],
  insuranceVerifications: [],
  promotion: null,
} satisfies FleetCar;

const fixtureDocuments = [
  {
    id: "doc-mot",
    documentType: "MOT_CERTIFICATE",
    status: "PENDING",
    documentUrl: "https://cdn.example.com/mot.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: fixtureCar.id,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
  {
    id: "doc-insurance",
    documentType: "INSURANCE_CERTIFICATE",
    status: "PENDING",
    documentUrl: "https://cdn.example.com/insurance.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: fixtureCar.id,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
] satisfies FleetCar["documents"];

const fixtureImages = Array.from({ length: 3 }, (_, index) => ({
  id: `img-${index + 1}`,
  url: `https://cdn.example.com/car-${index + 1}.jpg`,
  status: "PENDING" as const,
  isPrimary: index === 0,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
})) satisfies FleetCar["images"];

const fixturePricing = {
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fuelUpgradeRate: 20_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
} as const;

const currentInsurance = [
  {
    id: "ins-1",
    status: "SUCCEEDED",
    policyNumber: "POL-12345",
    policyStatus: "Active",
    policyExpiresAt: "2099-12-31T00:00:00.000Z",
    createdAt: "2026-09-07T12:00:00.000Z",
  },
] satisfies FleetCar["insuranceVerifications"];

const expiredInsurance = [
  {
    ...currentInsurance[0],
    policyStatus: "Expired",
    policyExpiresAt: "2026-01-01T00:00:00.000Z",
  },
] satisfies FleetCar["insuranceVerifications"];

function carForStep(step: string | null): FleetCar {
  if (step === "photos") {
    return { ...fixtureCar, documents: fixtureDocuments };
  }

  if (step === "pricing") {
    return { ...fixtureCar, documents: fixtureDocuments, images: fixtureImages };
  }

  if (step === "submit") {
    return {
      ...fixtureCar,
      documents: fixtureDocuments,
      images: fixtureImages,
      insuranceVerifications: currentInsurance,
      ...fixturePricing,
    };
  }

  if (step === "insurance-recovery") {
    return {
      ...fixtureCar,
      documents: fixtureDocuments,
      images: fixtureImages,
      insuranceVerifications: expiredInsurance,
      ...fixturePricing,
    };
  }

  return fixtureCar;
}

export default function CarOnboardingFixture() {
  const [searchParams] = useSearchParams();

  return (
    <FleetCarOnboardingPage
      car={carForStep(searchParams.get("step"))}
      idempotencyKey={IDEMPOTENCY_KEY}
    />
  );
}
