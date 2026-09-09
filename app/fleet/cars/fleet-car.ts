import type {
  FleetCar,
  FleetCarApprovalStatus,
  FleetCarDocumentStatus,
  FleetCarStatus,
} from "~/api/fleet/cars/schema";
import { formatCurrency } from "~/money/currency";

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
};

export function hasFleetCarPricing(car: FleetCar): car is FleetCarWithPricing {
  return (
    car.hourlyRate !== null &&
    car.dayRate !== null &&
    car.nightRate !== null &&
    car.fullDayRate !== null &&
    car.airportPickupRate !== null &&
    (car.pricingIncludesFuel || car.fuelUpgradeRate !== null)
  );
}

export function needsFleetCarOnboarding(car: FleetCar) {
  return car.submittedAt === null;
}

export type FleetCarOnboardingStep = "documents" | "photos" | "pricing" | "submit";

export function getFleetCarOnboardingStep(car: FleetCar): FleetCarOnboardingStep {
  if (car.documents.length < 2) return "documents";
  if (car.images.length === 0) return "photos";
  if (!hasFleetCarPricing(car)) return "pricing";
  return "submit";
}
