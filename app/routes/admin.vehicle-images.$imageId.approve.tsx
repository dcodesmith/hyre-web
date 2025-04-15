import { json, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";
import { requireUserWithRole } from "~/modules/auth/auth.server";
import { DocumentStatus } from "@prisma/client";

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, "admin");
  const imageId = params.imageId;

  if (!imageId) {
    throw new Error("Image ID is required");
  }

  const image = await prisma.vehicleImage.update({
    where: { id: imageId },
    data: {
      status: DocumentStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
    },
    include: {
      car: true,
    },
  });

  // Check if all documents and images for this car are approved
  const [pendingDocuments, pendingImages] = await Promise.all([
    prisma.documentApproval.findMany({
      where: {
        carId: image.car.id,
        status: DocumentStatus.PENDING,
      },
    }),
    prisma.vehicleImage.findMany({
      where: {
        carId: image.car.id,
        status: DocumentStatus.PENDING,
      },
    }),
  ]);

  // Only approve the car if all documents and images are approved
  if (pendingDocuments.length === 0 && pendingImages.length === 0) {
    await prisma.car.update({
      where: { id: image.car.id },
      data: {
        approvalStatus: "APPROVED",
      },
    });
  }

  return json({ success: true, image });
}
