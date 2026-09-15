import { useSearchParams } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import { FleetCarOnboardingPage } from "~/fleet/cars/fleet-car-onboarding-page";

const fixtureCar = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789101",
  publicRef: "0123456789abc101",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "018f47a2-7b3c-7d4e-8f90-123456789461",
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
    id: "018f47a2-7b3c-7d4e-8f90-123456789461",
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
    id: "018f47a2-7b3c-7d4e-8f90-1234567894c0",
    documentType: "VEHICLE_REGISTRATION",
    status: "PENDING",
    documentUrl: "https://cdn.example.com/vehicle-registration.pdf",
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: fixtureCar.id,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    userId: null,
  },
  {
    id: "018f47a2-7b3c-7d4e-8f90-1234567894c1",
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
    id: "018f47a2-7b3c-7d4e-8f90-1234567894c2",
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
  id: `018f47a2-7b3c-7d4e-8f90-12345678911${index + 1}`,
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
      ...fixturePricing,
    };
  }

  return fixtureCar;
}

export default function CarOnboardingFixture() {
  const [searchParams] = useSearchParams();

  return <FleetCarOnboardingPage car={carForStep(searchParams.get("step"))} />;
}
