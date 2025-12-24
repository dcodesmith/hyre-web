import type {
  Car,
  ChauffeurApprovalStatus,
  DocumentApproval,
  Prisma,
  VehicleType,
  ServiceTier,
} from "@prisma/client";

// Re-export Prisma enums as runtime values for frontend use
export const VehicleTypes = {
  SEDAN: "SEDAN",
  SUV: "SUV",
  LUXURY_SEDAN: "LUXURY_SEDAN",
  LUXURY_SUV: "LUXURY_SUV",
  VAN: "VAN",
  CROSSOVER: "CROSSOVER",
} as const;

export const ServiceTiers = {
  STANDARD: "STANDARD",
  EXECUTIVE: "EXECUTIVE",
  LUXURY: "LUXURY",
  ULTRA_LUXURY: "ULTRA_LUXURY",
} as const;

// Const arrays for Zod validation (derived from objects above)
export const VEHICLE_TYPES = Object.values(VehicleTypes) as [VehicleType, ...VehicleType[]];
export const SERVICE_TIERS = Object.values(ServiceTiers) as [ServiceTier, ...ServiceTier[]];

// Re-export types
export type { VehicleType, ServiceTier };

// Re-export as runtime value
export const AddonType = {
  SECURITY_DETAIL: "SECURITY_DETAIL",
} as const;

// Export the type
export type AddonType = (typeof AddonType)[keyof typeof AddonType];

export type SerializedCar = Omit<Car, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  fuelUpgradeRate: number;
  airportPickupRate: number;
  owner: {
    username: string | null;
    name: string | null;
  };
  images: { url: string }[];
  documents: (Omit<DocumentApproval, "createdAt" | "updatedAt" | "approvedAt"> & {
    createdAt: string;
    updatedAt: string;
    approvedAt: string | null;
  })[];
};

export type ChauffeurStatus = "ON_TRIP" | "AVAILABLE" | "ASSIGNED";

export type SerializedChauffeur = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  status: ChauffeurStatus;
  assignedCar: {
    make: string;
    model: string;
    registrationNumber: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  approvalStatus: ChauffeurApprovalStatus;
};

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    chauffeur: true;
    user: true;
    // guestUser: true;
    car: { include: { owner: { include: { chauffeurs: true } } } };
    legs: {
      include: {
        extensions: true;
      };
    };
  };
}>;

export type Extension = Prisma.ExtensionGetPayload<{
  include: { bookingLeg: { include: { booking: { include: { car: true; user: true } } } } };
}>;

export type BookingLegWithRelations = Prisma.BookingLegGetPayload<{
  include: { extensions: true };
}>;
