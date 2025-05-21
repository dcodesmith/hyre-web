import { prisma } from "~/modules/db/db.server";
import { PaymentStatus } from "@prisma/client";

interface UpsertExtension {
  bookingId: string;
  hours: number;
  totalAmount: number;
  endDate: Date;
  originalEndDate: Date;
  paymentId?: string;
  paymentIntent?: string;
  status?: string;
  day: Date; // The specific day being extended
  extensionId?: string;
}

// create an upsert extension function
export async function upsertExtension({
  bookingId,
  totalAmount,
  endDate,
  originalEndDate,
  paymentId,
  paymentIntent,
  hours,
  day,
  status = "PENDING",
  extensionId = "",
}: UpsertExtension) {
  return prisma.extension.upsert({
    where: { id: extensionId },
    create: {
      bookingId,
      day,
      startDate: new Date(), // Current time as extension start
      endDate,
      originalEndDate,
      totalAmount,
      hours,
      paymentId,
      paymentIntent,
      status,
      paymentStatus: paymentId ? PaymentStatus.PAID : PaymentStatus.UNPAID,
    },
    update: {
      hours: { increment: hours },
      totalAmount: { increment: totalAmount },
      endDate,
      paymentId,
      paymentIntent,
      status,
      paymentStatus: paymentId ? PaymentStatus.PAID : PaymentStatus.UNPAID,
    },
  });
}

// Create a pending extension with payment intent
export async function createPendingExtension({
  bookingId,
  hours,
  totalAmount,
  endDate,
  originalEndDate,
  paymentIntent,
  day,
}: Omit<UpsertExtension, "paymentId" | "status" | "extensionId"> & { paymentIntent: string }) {
  return prisma.extension.create({
    data: {
      bookingId,
      day,
      startDate: new Date(),
      endDate,
      originalEndDate,
      totalAmount,
      hours,
      paymentIntent,
      status: "PENDING",
      paymentStatus: PaymentStatus.UNPAID,
    },
  });
}

// Activate an extension after payment is confirmed
export async function activateExtension(extensionId: string, paymentId: string) {
  return prisma.extension.update({
    where: { id: extensionId },
    data: {
      paymentId,
      status: "ACTIVE",
      paymentStatus: PaymentStatus.PAID,
    },
  });
}

// Find an extension by payment intent
export async function findExtensionByPaymentIntent(paymentIntent: string) {
  return prisma.extension.findFirst({
    where: { paymentIntent },
    include: { booking: { include: { car: true, user: true } } },
  });
}

// Find a pending extension
export async function findPendingExtension(bookingId: string, day: Date) {
  return prisma.extension.findFirst({
    where: {
      bookingId,
      day,
      status: "PENDING",
    },
    include: { booking: { include: { car: true, user: true } } },
  });
}

export async function getExtension(extensionId: string) {
  return prisma.extension.findUnique({
    where: { id: extensionId },
    include: { booking: true },
  });
}

export async function getBookingExtensions(bookingId: string) {
  return prisma.extension.findMany({
    where: { bookingId },
    orderBy: { day: "asc" },
  });
}

export async function hasExtensionForDay(bookingId: string, day: Date) {
  const extension = await prisma.extension.findUnique({
    where: {
      bookingId_day: {
        bookingId,
        day,
      },
    },
  });
  return extension !== null;
}

// Clean up abandoned pending extensions
export async function cleanupPendingExtensions(olderThan: Date) {
  return prisma.extension.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: olderThan },
    },
    data: {
      status: "CANCELLED",
    },
  });
}
