import type {
  FleetCar,
  FleetCarApprovalStatus,
  FleetCarDocumentStatus,
  FleetCarStatus,
} from "~/api/fleet/cars/schema";
import { formatCurrency } from "~/money/currency";

export function ineligibleFleetVehicleMessage(minimumYear: number) {
  return `This vehicle is not eligible. Use a vehicle from ${minimumYear} or newer, or check the plate and try again.`;
}

export function soleOwnerDriverCar<T>(isOwnerDriver: boolean, cars: readonly T[]) {
  return isOwnerDriver && cars.length === 1 ? (cars[0] ?? null) : null;
}

const statusLabels: Record<FleetCarStatus, string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  HOLD: "Hold",
  IN_SERVICE: "In Service",
};

const approvalLabels: Record<FleetCarApprovalStatus, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Needs attention",
};

const documentStatusLabels: Record<FleetCarDocumentStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const documentTypeLabels: Record<FleetCar["documents"][number]["documentType"], string> = {
  VEHICLE_REGISTRATION: "Vehicle registration",
  MOT_CERTIFICATE: "MOT certificate",
  INSURANCE_CERTIFICATE: "Insurance certificate",
};

const vehicleTypeLabels: Record<FleetCar["vehicleType"], string> = {
  SEDAN: "Sedan",
  SUV: "SUV",
  VAN: "Van",
  CROSSOVER: "Crossover",
};

const serviceTierLabels: Record<FleetCar["serviceTier"], string> = {
  STANDARD: "Standard",
  EXECUTIVE: "Executive",
  LUXURY: "Luxury",
  ULTRA_LUXURY: "Ultra luxury",
};

export function getFleetCarStatusLabel(status: FleetCarStatus) {
  return statusLabels[status];
}

export function getFleetCarApprovalLabel(status: FleetCarApprovalStatus) {
  return approvalLabels[status];
}

export function getFleetCarDocumentStatusLabel(status: FleetCarDocumentStatus) {
  return documentStatusLabels[status];
}

export function getFleetCarDocumentTypeLabel(type: FleetCar["documents"][number]["documentType"]) {
  return documentTypeLabels[type];
}

export function getFleetCarVehicleTypeLabel(type: FleetCar["vehicleType"]) {
  return vehicleTypeLabels[type];
}

export function getFleetCarServiceTierLabel(tier: FleetCar["serviceTier"]) {
  return serviceTierLabels[tier];
}

export function formatFleetCarRate(rate: number | null) {
  return rate === null ? "Not set" : formatCurrency(rate);
}

type FleetCarWithPricing = FleetCar & {
  airportPickupRate: number;
  dayRate: number;
  fullDayRate: number;
  hourlyRate: number;
  nightRate: number;
  passengerCapacity: number;
};

export function hasFleetCarPricing(car: FleetCar): car is FleetCarWithPricing {
  return (
    car.hourlyRate !== null &&
    car.dayRate !== null &&
    car.nightRate !== null &&
    car.fullDayRate !== null &&
    car.airportPickupRate !== null &&
    car.passengerCapacity != null &&
    (car.pricingIncludesFuel || car.fuelUpgradeRate !== null)
  );
}

export function needsFleetCarOnboarding(car: FleetCar) {
  return car.submittedAt === null;
}

export type FleetCarOnboardingStep = "documents" | "photos" | "pricing" | "submit";
export type FleetCarOnboardingStage = "vehicle" | FleetCarOnboardingStep;

export const FLEET_CAR_ONBOARDING_STAGES = [
  { key: "vehicle", label: "Vehicle" },
  { key: "documents", label: "Documents" },
  { key: "photos", label: "Photos" },
  { key: "pricing", label: "Pricing" },
  { key: "submit", label: "Submit" },
] as const satisfies readonly { key: FleetCarOnboardingStage; label: string }[];

export const MIN_FLEET_CAR_IMAGES = 3;
export const REQUIRED_FLEET_CAR_DOCUMENT_TYPES = [
  "VEHICLE_REGISTRATION",
  "MOT_CERTIFICATE",
  "INSURANCE_CERTIFICATE",
] as const satisfies readonly FleetCar["documents"][number]["documentType"][];

export function getFleetCarOnboardingStep(car: FleetCar): FleetCarOnboardingStep {
  if (
    !REQUIRED_FLEET_CAR_DOCUMENT_TYPES.every((type) =>
      car.documents.some((document) => document.documentType === type),
    )
  ) {
    return "documents";
  }
  if (car.images.length < MIN_FLEET_CAR_IMAGES) return "photos";
  if (!hasFleetCarPricing(car)) return "pricing";
  return "submit";
}
