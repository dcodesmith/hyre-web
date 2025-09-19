import { type ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { DocumentStatus } from "@prisma/client";

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

  // If this is a car document, check if all documents and images are approved
  if (document.car) {
    const [pendingDocuments, pendingImages] = await Promise.all([
      prisma.documentApproval.findMany({
        where: {
          carId: document.car.id,
          status: DocumentStatus.PENDING,
        },
      }),
      prisma.vehicleImage.findMany({
        where: {
          carId: document.car.id,
          status: DocumentStatus.PENDING,
        },
      }),
    ]);

    // Only approve the car if all documents and images are approved
    if (pendingDocuments.length === 0 && pendingImages.length === 0) {
      await prisma.car.update({
        where: { id: document.car.id },
        data: {
          approvalStatus: "APPROVED",
        },
      });
    }
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
