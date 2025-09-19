import { CarApprovalStatus, DocumentStatus } from "@prisma/client";
import { type ActionFunctionArgs, data } from "@remix-run/node";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
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

  const image = await prisma.vehicleImage.update({
    where: { id: imageId },
    data: {
      status: DocumentStatus.REJECTED,
      approvedById: user.id,
      approvedAt: new Date(),
      notes,
    },
  });

  // Update car's approval status to PENDING with action note
  await prisma.car.update({
    where: { id: image.carId },
    data: {
      approvalStatus: CarApprovalStatus.PENDING,
      approvalNotes:
        "Action required! Some of your documents/images were rejected. Please check the rejection notes and re-upload them.",
    },
  });

  return { success: true, image };
}
