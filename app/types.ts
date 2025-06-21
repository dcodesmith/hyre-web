import type {
  // Booking,
  Car,
  ChauffeurApprovalStatus,
  DocumentApproval,
  Prisma,
  User,
} from "@prisma/client";

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

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    chauffeur: true;
    user: true;
    guestUser: true;
    car: { include: { owner: true } };
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
  include: {
    extensions: true;
    booking: {
      include: {
        car: { include: { owner: true } };
        user: true;
        chauffeur: true;
      };
    };
  };
}>;
