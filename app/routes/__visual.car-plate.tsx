import { useSearchParams } from "react-router";

import type { FleetVehicleVerification } from "~/api/fleet/cars/onboarding-schema";
import { FleetCarPlateVerificationPage } from "~/fleet/cars/fleet-car-plate-verification-page";

const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";

const verifiedVehicle = {
  id: "ver-1",
  status: "SUCCEEDED",
  vehicle: {
    plateNumber: "KJA123AB",
    chassisNumber: "1HGCM82633A004352",
    make: "Toyota",
    model: "Camry",
    year: 2020,
    color: "Black",
    passengerCapacity: 5,
  },
  eligibility: { isEligible: true, reasons: [] },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null,
} satisfies FleetVehicleVerification;

export default function CarPlateFixture() {
  const [searchParams] = useSearchParams();
  const actionData =
    searchParams.get("verified") === "true" ? { verification: verifiedVehicle } : undefined;

  return <FleetCarPlateVerificationPage actionData={actionData} idempotencyKey={IDEMPOTENCY_KEY} />;
}
