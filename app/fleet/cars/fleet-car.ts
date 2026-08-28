import type {
  FleetCar,
  FleetCarApprovalStatus,
  FleetCarDocumentStatus,
  FleetCarStatus,
} from "~/api/fleet/cars/schema";

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
