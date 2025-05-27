import type { Booking, Car, ChauffeurApprovalStatus, DocumentApproval, User } from "@prisma/client";

export type SerializedCar = Omit<Car, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
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
// Consistent BookingWithRelations type
export type BookingWithRelations = Booking & {
  car: Car & { owner?: User };
  user: User | null;
  // guestUser?: { name?: string | null; email?: string | null; phoneNumber?: string | null };
  chauffeur?: User | null;
};
