import { prisma } from "~/modules/db/db.server";
import { PaymentStatus } from "@prisma/client";

interface UpsertExtension {
  bookingId: string;
  hours: number;
  totalAmount: number;
  endDate: Date;
  originalEndDate: Date;
  paymentId: string;
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
  hours,
  day,
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
      paymentStatus: PaymentStatus.PAID,
    },
    update: {
      hours: { increment: hours },
      totalAmount: { increment: totalAmount },
      endDate,
      paymentId,
    },
  });
}

// export async function updateExtensionPayment(
//   extensionId: string,
//   paymentId: string,
//   status: PaymentStatus,
// ) {
//   return prisma.extension.update({
//     where: { id: extensionId },
//     data: {
//       paymentStatus: status,
//       paymentId,
//       paidAt: status === PaymentStatus.PAID ? new Date() : null,
//       status: status === PaymentStatus.PAID ? "approved" : "pending",
//     },
//   });
// }

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
