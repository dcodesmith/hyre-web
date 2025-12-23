import type { Car, ChauffeurApprovalStatus, DocumentApproval, Prisma } from "@prisma/client";

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
