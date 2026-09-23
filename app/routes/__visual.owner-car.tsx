import type { FleetCar } from "~/api/fleet/cars/schema";
import { FleetCarDetail } from "~/fleet/cars/fleet-car-detail";

const ownerCar = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789471",
  publicRef: "0123456789abc471",
  make: "Lexus",
  model: "RX 350",
  year: 2023,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "018f47a2-7b3c-7d4e-8f90-123456789461",
  registrationNumber: "ABC123XY",
  status: "AVAILABLE",
  approvalStatus: "APPROVED",
  approvalNotes: null,
  submittedAt: "2026-09-07T12:00:00.000Z",
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fuelUpgradeRate: 20_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  passengerCapacity: 4,
  pricingIncludesFuel: false,
  owner: {
    id: "018f47a2-7b3c-7d4e-8f90-123456789461",
    name: "Ada Lovelace",
    username: null,
    email: "owner@example.com",
  },
  images: [
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789481",
      url: "/images/hero.webp",
      status: "APPROVED",
      isPrimary: true,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
  documents: [],
  insuranceVerifications: [],
  promotion: null,
} satisfies FleetCar;

export default function OwnerCarVisual() {
  return <FleetCarDetail backHref={null} car={ownerCar} />;
}
