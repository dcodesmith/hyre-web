import { Status, DocumentApproval } from "@prisma/client";
import type { BookingWithRelations } from "~/types";

export interface CarInfo {
  readonly id: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly registrationNumber: string;
  readonly status: Status;
  readonly motCertificate?: DocumentApproval;
  readonly insuranceCertificate?: DocumentApproval;
  readonly lasdriCertificate?: DocumentApproval;
}

export interface EarningsData {
  readonly today: number;
  readonly thisWeek: {
    readonly amount: number;
    readonly bookingCount: number;
  };
  readonly thisMonth: {
    readonly amount: number;
    readonly bookingCount: number;
  };
}

export interface NextPayoutInfo {
  readonly id: string;
  readonly amount: number;
  readonly status: string;
  readonly scheduledDate: Date;
}

export interface PersonalDocuments {
  readonly nin?: DocumentApproval;
  readonly driversLicense?: DocumentApproval;
  readonly lasdri?: DocumentApproval;
}

export interface OwnerDriverDashboardData {
  readonly name: string;
  readonly pendingApprovalBookings: BookingWithRelations[];
  readonly liveBookings: BookingWithRelations[];
  readonly upcomingBookings: BookingWithRelations[];
  readonly recentBookings: BookingWithRelations[];
  readonly personalDocuments?: PersonalDocuments;
  readonly car?: CarInfo;
  readonly earnings: EarningsData;
  readonly nextPayout?: NextPayoutInfo;
}
