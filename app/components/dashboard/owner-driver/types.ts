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

export interface OwnerDriverDashboardData {
  readonly name: string;
  readonly currentOrNextBooking?: BookingWithRelations;
  readonly upcomingBookings: BookingWithRelations[];
  readonly recentBookings: BookingWithRelations[];
  readonly car?: CarInfo;
  readonly earnings: EarningsData;
  readonly nextPayout?: NextPayoutInfo;
}
