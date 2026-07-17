import { type ActionFunctionArgs, redirect } from "react-router";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { DocumentStatus, CarApprovalStatus } from "@prisma/client";
import { lockCarRow } from "~/services/cars.server";
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

  await prisma.$transaction(async (tx) => {
    const updated = await tx.documentApproval.update({
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

    // If this is a car document, demote the car behind a row lock so a
    // concurrent approveCarIfFullyReviewed can't leave it APPROVED with this
    // now-rejected document.
    if (updated.car) {
      await lockCarRow(tx, updated.car.id);
      await tx.car.update({
        where: { id: updated.car.id },
        data: {
          approvalStatus: CarApprovalStatus.PENDING,
          approvalNotes:
            "Action required! Some of your documents/images were rejected. Please check the rejection notes and re-upload them.",
        },
      });
    }

    // If this is a chauffeur document, update the chauffeur's approval status
    if (updated.user) {
      await tx.user.update({
        where: { id: updated.user.id },
        data: {
          chauffeurApprovalStatus: "REJECTED",
        },
      });
    }

    return updated;
  });

  return redirect("/admin/documents");
}
