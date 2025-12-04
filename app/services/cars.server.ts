import {
  Car,
  Prisma,
  DocumentStatus,
  DocumentType,
  Status,
  CarApprovalStatus,
} from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { deleteFileFromS3, uploadFileToS3 } from "./s3.server";
import logger from "~/lib/logger.server";

/**
 * Checks if an owner-driver has reached their car limit (1 car max).
 * This is a pure business rule function that returns a boolean.
 * @param userId - The user ID to check
 * @returns true if the user has reached the limit (has 1 or more cars), false otherwise
 */
export async function hasReachedOwnerDriverCarLimit(userId: string): Promise<boolean> {
  const existingCars = await prisma.car.count({
    where: { ownerId: userId },
  });

  return existingCars >= 1;
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

  const uploadedKeys: string[] = [];
  const track = async (p: Promise<string>) => {
    const url = await p;
    uploadedKeys.push(new URL(url).pathname.slice(1)); // depends on uploadFileToS3 return
    return url;
  };

  try {
    // Step 2: Perform file uploads concurrently
    const [imageUrls, motCertificateUrl, insuranceCertificateUrl] = await Promise.all([
      Promise.all(images.map((image) => track(uploadFileToS3(image, getKey(car, image))))),
      track(uploadFileToS3(motCertificate, getKey(car, motCertificate))),
      track(uploadFileToS3(insuranceCertificate, getKey(car, insuranceCertificate))),
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
      // Best-effort S3 cleanup (ignore failures)
      for (const key of uploadedKeys) {
        try {
          await deleteFileFromS3(key);
        } catch (error) {
          logger.error("Failed to delete file from S3", { error });
        }
      }
    } catch (error) {
      logger.error("Failed to delete car", { error });
    }
    throw new Error("Failed to create car and related assets", { cause: error as Error });
  }
}
