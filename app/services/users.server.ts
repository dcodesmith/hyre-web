import { Prisma, DocumentType, DocumentStatus } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { uploadFileToS3 } from "./s3.server";

export async function createUser({
  ninFile,
  drivingLicenceFile,
  ...data
}: Omit<Prisma.UserCreateInput, "ninUrl" | "drivingLicenceUrl"> & {
  ninFile: File;
  drivingLicenceFile: File;
}) {
  const user = await prisma.user.create({ data });

  try {
    const timestamp = Date.now();
    const ninKey = `${user.id}/${timestamp}-${ninFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const drivingLicenceKey = `${user.id}/${timestamp}-${drivingLicenceFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const [ninUrl, drivingLicenceUrl] = await Promise.all([
      uploadFileToS3(ninFile, ninKey),
      uploadFileToS3(drivingLicenceFile, drivingLicenceKey),
    ]);

    // Create document approvals
    await prisma.documentApproval.createMany({
      data: [
        {
          documentType: DocumentType.NIN,
          documentUrl: ninUrl,
          chauffeurId: user.id,
          status: DocumentStatus.PENDING,
        },
        {
          documentType: DocumentType.DRIVERS_LICENSE,
          documentUrl: drivingLicenceUrl,
          chauffeurId: user.id,
          status: DocumentStatus.PENDING,
        },
      ],
    });
  } catch (error) {
    // Delete document approvals first
    await prisma.documentApproval.deleteMany({
      where: { chauffeurId: user.id },
    });

    // Then delete the user
    await prisma.user.delete({ where: { id: user.id } });

    throw new Error("Failed to upload user documents", { cause: error });
  }
}
