import { prisma } from "~/modules/db/db.server";
import { PaymentStatus } from "@prisma/client";
import logger from "~/lib/logger.server";

// Activate an extension after payment is confirmed
export async function activateExtension(extensionId: string, paymentId: string) {
  const extension = await prisma.$transaction(async (transaction) => {
    const extension = await transaction.extension.update({
      where: { id: extensionId },
      data: {
        paymentId,
        status: "ACTIVE",
        paymentStatus: PaymentStatus.PAID,
      },
      include: {
        bookingLeg: {
          include: { booking: { include: { car: { include: { owner: true } }, user: true } } },
        },
      },
    });

    await transaction.bookingLeg.update({
      where: { id: extension.bookingLeg.id },
      data: {
        legEndTime: extension.extensionEndTime,
      },
    });

    return extension;
  });

  logger.debug(`Activated extension: ${JSON.stringify(extension, null, 2)}`);

  return extension;
}

// Find an extension by payment intent
export async function findExtensionByPaymentIntent(paymentIntent: string) {
  return prisma.extension.findFirst({
    where: { paymentIntent },
    include: { bookingLeg: { include: { booking: { include: { car: true, user: true } } } } },
  });
}

export async function getExtension(extensionId: string) {
  return prisma.extension.findUnique({
    where: { id: extensionId },
    include: { bookingLeg: { include: { booking: true } } },
  });
}

export async function getBookingExtensions(bookingLegId: string) {
  return prisma.extension.findMany({
    where: { bookingLegId },
    orderBy: { createdAt: "asc" },
  });
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
