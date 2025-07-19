import { json, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { DocumentStatus, CarApprovalStatus } from "@prisma/client";

export async function action({ request, params }: ActionFunctionArgs) {
  const { user } = await requireAdminOrStaffWithRedirect(request);
  const imageId = params.imageId;

  if (!imageId) {
    throw new Error("Image ID is required");
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
    include: {
      car: true,
    },
  });

  // Update car's approval status to PENDING with action note
  await prisma.car.update({
    where: { id: image.car.id },
    data: {
      approvalStatus: CarApprovalStatus.PENDING,
      approvalNotes:
        "Action required! Some of your documents/images were rejected. Please check the rejection notes and re-upload them.",
    },
  });

  return redirect("/admin/documents");
}
