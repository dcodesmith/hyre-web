import { type ActionFunctionArgs, data } from "react-router";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { DocumentStatus } from "@prisma/client";
import { validateCSRF } from "~/utils/csrf-action.server";
import { approveCarIfFullyReviewed } from "~/services/cars.server";

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

  // Promote the car only when every image and document is approved.
  await approveCarIfFullyReviewed(image.carId);

  return { success: true, image };
}
