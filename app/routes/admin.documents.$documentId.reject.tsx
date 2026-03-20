import { type ActionFunctionArgs, redirect } from "react-router";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { DocumentStatus, CarApprovalStatus } from "@prisma/client";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  const { user } = await requireAdminOrStaffWithRedirect(request);
  const documentId = params.documentId;

  if (!documentId) {
    throw new Error("Document ID is required");
  }

  const formData = await request.formData();
  const notes = formData.get("notes") as string;

  const document = await prisma.documentApproval.update({
    where: { id: documentId },
    data: {
      status: DocumentStatus.REJECTED,
      approvedById: user.id,
      approvedAt: new Date(),
      notes,
    },
    include: {
      car: true,
      user: true,
    },
  });

  // If this is a car document, update the car's approval status to PENDING with action note
  if (document.car) {
    await prisma.car.update({
      where: { id: document.car.id },
      data: {
        approvalStatus: CarApprovalStatus.PENDING,
        approvalNotes:
          "Action required! Some of your documents/images were rejected. Please check the rejection notes and re-upload them.",
      },
    });
  }

  // If this is a chauffeur document, update the chauffeur's approval status
  if (document.user) {
    await prisma.user.update({
      where: { id: document.user.id },
      data: {
        chauffeurApprovalStatus: "REJECTED",
      },
    });
  }

  return redirect("/admin/documents");
}
