import { useSearchParams } from "react-router";

import type { FleetVehicleVerification } from "~/api/fleet/cars/onboarding-schema";
import { ineligibleFleetVehicleMessage } from "~/fleet/cars/fleet-car";
import { FleetCarPlateVerificationPage } from "~/fleet/cars/fleet-car-plate-verification-page";

const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";

const verifiedVehicle = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
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
  eligibility: { isEligible: true, reasons: [], minimumYear: 2011 },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null,
} satisfies FleetVehicleVerification;

export default function CarPlateFixture() {
  const [searchParams] = useSearchParams();
  const actionData =
    searchParams.get("verified") === "true"
      ? { verification: verifiedVehicle }
      : searchParams.get("error") === "ineligible"
        ? {
            error: ineligibleFleetVehicleMessage(2011),
          }
        : undefined;

  return <FleetCarPlateVerificationPage actionData={actionData} idempotencyKey={IDEMPOTENCY_KEY} />;
}
