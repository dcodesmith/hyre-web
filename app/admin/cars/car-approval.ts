import type {
  AdminCar,
  AdminCarApprovalStatus,
  AdminCarAssetStatus,
} from "~/api/admin/cars/schema";

export type AdminCarListItem = Pick<
  AdminCar,
  "approvalStatus" | "id" | "make" | "model" | "registrationNumber" | "year"
> & {
  readonly owner: Pick<AdminCar["owner"], "email" | "name" | "username">;
  readonly pendingAssetCount: number;
};

export type AdminCarDetailData = Pick<
  AdminCar,
  | "approvalNotes"
  | "approvalStatus"
  | "color"
  | "id"
  | "make"
  | "model"
  | "passengerCapacity"
  | "registrationNumber"
  | "vehicleType"
  | "year"
> & {
  readonly documents: Pick<
    AdminCar["documents"][number],
    "documentType" | "id" | "notes" | "status"
  >[];
  readonly images: Pick<
    AdminCar["images"][number],
    "id" | "isPrimary" | "notes" | "status" | "url"
  >[];
  readonly owner: Pick<AdminCar["owner"], "email" | "name" | "username">;
};

const statusLabels: Record<AdminCarApprovalStatus | AdminCarAssetStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const documentTypeLabels: Record<AdminCar["documents"][number]["documentType"], string> = {
  MOT_CERTIFICATE: "MOT certificate",
  INSURANCE_CERTIFICATE: "Insurance certificate",
};

export function getAdminCarReviewLabel(status: AdminCarApprovalStatus | AdminCarAssetStatus) {
  return statusLabels[status];
}

export function getAdminCarDocumentTypeLabel(type: AdminCar["documents"][number]["documentType"]) {
  return documentTypeLabels[type];
}

export function getAdminCarPendingAssetCount(car: AdminCar) {
  let count = 0;
  for (const image of car.images) {
    if (image.status === "PENDING") {
      count += 1;
    }
  }
  for (const document of car.documents) {
    if (document.status === "PENDING") {
      count += 1;
    }
  }
  return count;
}

export function toAdminCarListItem(car: AdminCar): AdminCarListItem {
  return {
    id: car.id,
    make: car.make,
    model: car.model,
    year: car.year,
    registrationNumber: car.registrationNumber,
    approvalStatus: car.approvalStatus,
    owner: {
      email: car.owner.email,
      name: car.owner.name,
      username: car.owner.username,
    },
    pendingAssetCount: getAdminCarPendingAssetCount(car),
  };
}

export function toAdminCarDetailData(car: AdminCar): AdminCarDetailData {
  return {
    approvalNotes: car.approvalNotes,
    approvalStatus: car.approvalStatus,
    color: car.color,
    documents: car.documents.map(({ documentType, id, notes, status }) => ({
      documentType,
      id,
      notes,
      status,
    })),
    id: car.id,
    images: car.images.map(({ id, isPrimary, notes, status, url }) => ({
      id,
      isPrimary,
      notes,
      status,
      url,
    })),
    make: car.make,
    model: car.model,
    owner: {
      email: car.owner.email,
      name: car.owner.name,
      username: car.owner.username,
    },
    passengerCapacity: car.passengerCapacity,
    registrationNumber: car.registrationNumber,
    vehicleType: car.vehicleType,
    year: car.year,
  };
}
