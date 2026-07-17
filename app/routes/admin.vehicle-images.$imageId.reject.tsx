import { CarApprovalStatus, DocumentStatus } from "@prisma/client";
import { type ActionFunctionArgs, data } from "react-router";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { lockCarRow } from "~/services/cars.server";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  const { user } = await requireAdminOrStaffWithRedirect(request);
  const imageId = params.imageId;

  if (!imageId) {
    return data({ success: false, error: "Image ID is required" }, { status: 400 });
  }

  const formData = await request.formData();
  const notes = formData.get("notes") as string;

  // Reject the image and demote the car in one transaction, behind a row lock,
  // so a concurrent approveCarIfFullyReviewed can't leave the car APPROVED with
  // this now-rejected image.
  const image = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicleImage.update({
      where: { id: imageId },
      data: {
        status: DocumentStatus.REJECTED,
        approvedById: user.id,
        approvedAt: new Date(),
        notes,
      },
    });

    await lockCarRow(tx, updated.carId);
    await tx.car.update({
      where: { id: updated.carId },
      data: {
        approvalStatus: CarApprovalStatus.PENDING,
        approvalNotes:
          "Action required! Some of your documents/images were rejected. Please check the rejection notes and re-upload them.",
      },
    });

    return updated;
  });

  return { success: true, image };
}
