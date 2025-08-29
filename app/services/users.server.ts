import { Prisma, DocumentType, DocumentStatus, ChauffeurApprovalStatus } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { uploadFileToS3 } from "./s3.server";

export async function createUser({
  ninFile,
  drivingLicenceFile,
  autoApprove = false,
  ...data
}: Omit<Prisma.UserCreateInput, "ninUrl" | "drivingLicenceUrl"> & {
  ninFile: File;
  drivingLicenceFile: File;
  autoApprove?: boolean;
}) {
  const user = await prisma.user.create({
    data: {
      ...data,
      ...(autoApprove && { chauffeurApprovalStatus: ChauffeurApprovalStatus.APPROVED }),
    },
  });

  try {
    const timestamp = Date.now();
    const ninKey = `${user.id}/${timestamp}-${ninFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const drivingLicenceKey = `${user.id}/${timestamp}-${drivingLicenceFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const [ninUrl, drivingLicenceUrl] = await Promise.all([
      uploadFileToS3(ninFile, ninKey),
      uploadFileToS3(drivingLicenceFile, drivingLicenceKey),
    ]);

    // Create document approvals (auto-approved for chauffeurs created by fleet owners)
    await prisma.documentApproval.createMany({
      data: [
        {
          documentType: DocumentType.NIN,
          documentUrl: ninUrl,
          userId: user.id,
          status: autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING, // Auto-approve NIN document
        },
        {
          documentType: DocumentType.DRIVERS_LICENSE,
          documentUrl: drivingLicenceUrl,
          userId: user.id,
          status: autoApprove ? DocumentStatus.APPROVED : DocumentStatus.PENDING, // Auto-approve driver's license
        },
      ],
    });
  } catch (error) {
    // Delete document approvals first
    await prisma.documentApproval.deleteMany({
      where: { userId: user.id },
    });

    // Then delete the user
    await prisma.user.delete({ where: { id: user.id } });

    throw new Error("Failed to upload user documents", { cause: error });
  }
}
