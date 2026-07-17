import { type ActionFunctionArgs } from "react-router";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { DocumentStatus } from "@prisma/client";
import { approveCarIfFullyReviewed } from "~/services/cars.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { user } = await requireAdminOrStaffWithRedirect(request);
  const documentId = params.documentId;

  if (!documentId) {
    throw new Error("Document ID is required");
  }

  const document = await prisma.documentApproval.update({
    where: { id: documentId },
    data: {
      status: DocumentStatus.APPROVED,
      approvedById: user.id,
      approvedAt: new Date(),
    },
    include: {
      car: true,
      user: true,
    },
  });

  // If this is a car document, promote the car only when every image and
  // document is approved.
  if (document.car) {
    await approveCarIfFullyReviewed(document.car.id);
  }

  // If this is a chauffeur document, update the chauffeur's approval status if all required documents are approved
  if (document.userId) {
    const chauffeurDocuments = await prisma.documentApproval.findMany({
      where: {
        userId: document.userId,
        status: DocumentStatus.PENDING,
      },
    });

    if (chauffeurDocuments.length === 0) {
      await prisma.user.update({
        where: { id: document.userId },
        data: {
          chauffeurApprovalStatus: "APPROVED",
        },
      });
    }
  }

  return { success: true, document };
}
