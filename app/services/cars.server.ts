import { Car, Prisma, DocumentStatus, DocumentType, Status } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { uploadFileToS3 } from "./s3.server";

export async function isCarAvailable(
  carId: string,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: {
      bookings: {
        where: {
          //   Only check active bookings
          status: {
            in: ["CONFIRMED", "ACTIVE"],
          },
          // Check for any date overlap
          OR: [
            // New booking starts during an existing booking
            {
              // startDate: { lte: endDate },
              // endDate: { gte: startDate },

              startDate: {
                lte: new Date(endDate.setHours(23, 59, 59, 999)),
              },
              endDate: {
                gte: new Date(startDate.setHours(0, 0, 0, 0)),
              },
            },
          ],
        },
      },
    },
  });

  if (!car) {
    throw new Error("Car not found");
  }

  // Car is available if it's status is AVAILABLE and has no overlapping bookings
  return car.bookings.length === 0;
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
