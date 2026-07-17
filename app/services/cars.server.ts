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
          approvalStatus: CarApprovalStatus.PENDING,
        },
      });
    });

    // autoApprove must still clear the approval gate (>=1 approved image + all
    // required approved docs) so it can never publish an asset-less car.
    if (autoApprove) {
      await approveCarIfFullyReviewed(car.id);
    }

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

/**
 * Car documents that must exist and be APPROVED before a car can be listed.
 * Owner-level docs (NIN, licence) live on the user, not the car. Mirrors what
 * createCar always uploads.
 */
export const REQUIRED_CAR_DOCUMENT_TYPES: DocumentType[] = [
  DocumentType.MOT_CERTIFICATE,
  DocumentType.INSURANCE_CERTIFICATE,
];

/**
 * Take a row-level lock on a car within a transaction (`SELECT ... FOR UPDATE`)
 * so concurrent approval-status transitions (approve / reject / re-upload)
 * serialize per car and cannot interleave a stale read with a write. Returns
 * whether the car exists.
 */
export async function lockCarRow(
  tx: Prisma.TransactionClient,
  carId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT id FROM "Car" WHERE id = ${carId} FOR UPDATE`,
  );
  return rows.length > 0;
}

/**
 * Promote a car to APPROVED only when it actually has the required assets AND
 * every image and document is APPROVED. A car with no approved images, a missing
 * required document, or any PENDING/REJECTED item is not promotable. Returns
 * whether the car ended up approved. Single source of truth for the approval
 * gate — mirrors the API's CarApprovalService.approveCarIfFullyReviewed.
 *
 * The eligibility read and the promotion write run in one transaction behind a
 * row lock, so a concurrent document/image change cannot leave an ineligible
 * car approved.
 */
export async function approveCarIfFullyReviewed(carId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Serialize this car's approval read+write against reject/re-upload.
    await lockCarRow(tx, carId);

    const unresolvedFilter = {
      carId,
      status: { in: [DocumentStatus.PENDING, DocumentStatus.REJECTED] },
    };

    const [unresolvedDocuments, unresolvedImages, approvedImageCount, approvedRequiredDocs] =
      await Promise.all([
        tx.documentApproval.count({ where: unresolvedFilter }),
        tx.vehicleImage.count({ where: unresolvedFilter }),
        tx.vehicleImage.count({ where: { carId, status: DocumentStatus.APPROVED } }),
        tx.documentApproval.findMany({
          where: {
            carId,
            status: DocumentStatus.APPROVED,
            documentType: { in: REQUIRED_CAR_DOCUMENT_TYPES },
          },
          select: { documentType: true },
          distinct: ["documentType"],
        }),
      ]);

    const hasAllRequiredDocuments = REQUIRED_CAR_DOCUMENT_TYPES.every((type) =>
      approvedRequiredDocs.some((doc) => doc.documentType === type),
    );

    const fullyReviewed =
      unresolvedDocuments === 0 &&
      unresolvedImages === 0 &&
      approvedImageCount > 0 &&
      hasAllRequiredDocuments;

    if (fullyReviewed) {
      await tx.car.update({
        where: { id: carId },
        data: { approvalStatus: CarApprovalStatus.APPROVED, approvalNotes: null },
      });
    }

    return fullyReviewed;
  });
}
