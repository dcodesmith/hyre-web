import { Car, Prisma, DocumentStatus, DocumentType, Status, BookingType } from "@prisma/client";
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

  // If car status is not AVAILABLE, return false early
  if (car.status !== "AVAILABLE") {
    return false;
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
            lte: new Date(endDate.setHours(23, 59, 59, 999)),
          },
          endDate: {
            gte: new Date(startDate.setHours(0, 0, 0, 0)),
          },
        },
        // New night booking starts 3 hours after an existing booking ends
        {
          type: BookingType.NIGHT,
          endDate: {
            gte: new Date(startDate.setHours(20, 0, 0, 0)),
            lt: new Date(startDate.setHours(23, 0, 0, 0)),
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
  ...data
}: Omit<Prisma.CarCreateInput, "images" | "motCertificateUrl" | "insuranceCertificateUrl"> & {
  images: File[];
  motCertificate: File;
  insuranceCertificate: File;
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

    // Step 3: Create vehicle images
    await prisma.vehicleImage.createMany({
      data: imageUrls.map((url) => ({
        url,
        carId: car.id,
        status: DocumentStatus.PENDING,
      })),
    });

    // Step 4: Create document approvals for certificates
    await prisma.documentApproval.createMany({
      data: [
        {
          documentType: DocumentType.MOT_CERTIFICATE,
          documentUrl: motCertificateUrl,
          carId: car.id,
          status: DocumentStatus.PENDING,
        },
        {
          documentType: DocumentType.INSURANCE_CERTIFICATE,
          documentUrl: insuranceCertificateUrl,
          carId: car.id,
          status: DocumentStatus.PENDING,
        },
      ],
    });

    // Update car status to available
    await prisma.car.update({
      where: { id: car.id },
      data: {
        status: Status.AVAILABLE,
      },
    });

    return car;
  } catch (error) {
    await prisma.car.delete({ where: { id: car.id } });
    throw new Error("Failed to upload images", { cause: error });
  }
}
