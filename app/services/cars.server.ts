import {
  Car,
  Prisma,
  DocumentStatus,
  DocumentType,
  Status,
  BookingType,
  CarApprovalStatus,
} from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { uploadFileToS3 } from "./s3.server";

export async function isCarAvailable(
  carId: string,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  // First check if the car exists and is available
  const car = await prisma.car.findUnique({
    where: { id: carId },
    select: { id: true, status: true },
  });

  if (!car) {
    throw new Error("Car not found");
  }

  // Use a count query instead of fetching all bookings for better performance
  const conflictingBookingsCount = await prisma.booking.count({
    where: {
      carId,
      paymentStatus: "PAID",
      // Only check active or confirmed bookings
      status: {
        in: ["CONFIRMED", "ACTIVE"],
      },
      // Check for any date overlap or if it ends 3hrs before a night booking starts
      OR: [
        // New booking starts during an existing booking
        {
          startDate: {
            lte: (() => {
              const d = new Date(endDate);
              d.setHours(23, 59, 59, 999);
              return d;
            })(),
          },
          endDate: {
            gte: (() => {
              const d = new Date(startDate);
              d.setHours(0, 0, 0, 0);
              return d;
            })(),
          },
        },
        // New night booking starts 3 hours after an existing booking ends
        {
          type: BookingType.NIGHT,
          endDate: {
            gte: (() => {
              const d = new Date(startDate);
              d.setHours(20, 0, 0, 0);
              return d;
            })(),
            lt: (() => {
              const d = new Date(startDate);
              d.setHours(23, 0, 0, 0);
              return d;
            })(),
          },
        },
      ],
    },
  });

  // Car is available if it has no overlapping bookings
  return conflictingBookingsCount === 0;
}

const getKey = (car: Car, file: File) => {
  const timestamp = Date.now();
  const safeFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  return `${car.ownerId}/${car.id}-${safeFilename}`;
};

export async function createCar({
  images,
  motCertificate,
  insuranceCertificate,
  autoApprove = false,
  ...data
}: Omit<Prisma.CarCreateInput, "images" | "motCertificateUrl" | "insuranceCertificateUrl"> & {
  images: File[];
  motCertificate: File;
  insuranceCertificate: File;
  autoApprove?: boolean;
}) {
  // Step 1: Create the car record
  const car = await prisma.car.create({ data });

  try {
    // Step 2: Perform file uploads concurrently
    const [imageUrls, motCertificateUrl, insuranceCertificateUrl] = await Promise.all([
      Promise.all(images.map((image) => uploadFileToS3(image, getKey(car, image)))),
      uploadFileToS3(motCertificate, getKey(car, motCertificate)),
      uploadFileToS3(insuranceCertificate, getKey(car, insuranceCertificate)),
    ]);

    // Steps 3–5: persist in a single transaction for consistency
    await prisma.$transaction(async (tx) => {
      await tx.vehicleImage.createMany({
        data: imageUrls.map((url) => ({
          url,
          carId: car.id,
          status: autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING,
        })),
      });

      await tx.documentApproval.createMany({
        data: [
          {
            documentType: DocumentType.MOT_CERTIFICATE,
            documentUrl: motCertificateUrl,
            carId: car.id,
            status: autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING,
          },
          {
            documentType: DocumentType.INSURANCE_CERTIFICATE,
            documentUrl: insuranceCertificateUrl,
            carId: car.id,
            status: autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING,
          },
        ],
      });

      await tx.car.update({
        where: { id: car.id },
        data: {
          status: Status.AVAILABLE,
          approvalStatus: autoApprove ? CarApprovalStatus.APPROVED : CarApprovalStatus.PENDING,
        },
      });
    });

    return await prisma.car.findUnique({ where: { id: car.id } });
  } catch (error) {
    // best-effort cleanup; ignore if already removed or blocked
    try {
      await prisma.car.delete({ where: { id: car.id } });
    } catch {}
    throw new Error("Failed to create car and related assets", { cause: error as Error });
  }
}
