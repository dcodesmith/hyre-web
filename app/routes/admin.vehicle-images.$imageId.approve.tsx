import { type ActionFunctionArgs, data } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { CarApprovalStatus, DocumentStatus } from "@prisma/client";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  const { user } = await requireAdminOrStaffWithRedirect(request);
  const imageId = params.imageId;

  if (!imageId) {
    return data({ success: false, error: "Image ID is required" }, { status: 400 });
  }

  const image = await prisma.vehicleImage.update({
    where: { id: imageId },
    data: {
      status: DocumentStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });

  // Check if all documents and images for this car are approved
  const [pendingDocumentCount, pendingImageCount] = await Promise.all([
    prisma.documentApproval.count({
      where: {
        carId: image.carId,
        status: DocumentStatus.PENDING,
      },
    }),
    prisma.vehicleImage.count({
      where: {
        carId: image.carId,
        status: DocumentStatus.PENDING,
      },
    }),
  ]);

  // Only approve the car if all documents and images are approved
  if (pendingDocumentCount === 0 && pendingImageCount === 0) {
    await prisma.car.update({
      where: { id: image.carId },
      data: {
        approvalStatus: CarApprovalStatus.APPROVED,
        approvalNotes: null,
      },
    });
  }

  return { success: true, image };
}
