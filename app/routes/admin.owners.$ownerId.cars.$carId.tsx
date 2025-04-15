import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { prisma } from "~/modules/db/db.server"; // Update the import path
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CarApprovalStatus, DocumentApproval, DocumentStatus, DocumentType } from "@prisma/client";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { FileText } from "lucide-react";
import { SerializedCar } from "~/types";

export async function loader({ params }: LoaderFunctionArgs) {
  const car = await prisma.car.findUnique({
    where: { id: params.carId },
    include: {
      owner: {
        select: {
          name: true,
        },
      },
      documents: true,
      images: true,
    },
  });

  if (!car) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ car });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminWithRedirect(request);

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "approve") {
    await prisma.car.update({
      where: { id: params.carId },
      data: {
        approvalStatus: "APPROVED",
      },
    });
    return json({ success: true });
  }

  return json({ success: false });
}

export default function CarDetails() {
  const { car } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleApprove = () => {
    if (window.confirm("Are you sure you want to approve this car?")) {
      submit({ action: "approve" }, { method: "POST" });
    }
  };

  const approvalStatusColorMap: Record<CarApprovalStatus, string> = {
    PENDING: "text-yellow-600 border-yellow-600",
    APPROVED: "text-green-600 border-green-600",
    REJECTED: "text-red-600 border-red-600",
  };

  const approvalStatusTextMap: Record<CarApprovalStatus, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };

  // const images = car.images.filter((doc) => doc.status === "APPROVED");
  const motCertificate = car.documents.find((doc) => doc.documentType === "MOT_CERTIFICATE");
  const insuranceCertificate = car.documents.find(
    (doc) => doc.documentType === "INSURANCE_CERTIFICATE",
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-4">
        <h1 className="text-xl font-medium break-words flex items-center gap-2">
          <span>
            {car.make} {car.model} - {car.year} ({car.registrationNumber}) - {car.owner.name}
          </span>
          <Badge variant="outline" className={approvalStatusColorMap[car.approvalStatus]}>
            {approvalStatusTextMap[car.approvalStatus]}
          </Badge>
        </h1>
        {car.approvalStatus !== "APPROVED" && (
          <Button
            onClick={handleApprove}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
          >
            Approve Car
          </Button>
        )}
      </div>

      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {car.images.map((image, index) => (
            <div
              key={image.url}
              className="relative aspect-square cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage(image.url)}
            >
              <img
                src={image.url}
                alt={`${car.make} ${car.model} - ${index + 1}`}
                className="object-cover w-full h-full"
              />
            </div>
          ))}
        </div>

        <h2 className="text-lg font-medium mt-8 mb-4">Certificates</h2>
        <ul className="space-y-2">
          {motCertificate && (
            <li className="flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              <a
                href={motCertificate.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-48 hover:opacity-90 transition-opacity"
              >
                MOT Certificate
              </a>
            </li>
          )}

          {insuranceCertificate && (
            <li className="flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              <a
                href={insuranceCertificate.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-48 hover:opacity-90 transition-opacity"
              >
                Insurance Certificate
              </a>
            </li>
          )}
        </ul>

        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-[90vw] w-fit h-fit max-h-[90vh] p-0 flex items-center justify-center border-none bg-transparent shadow-none">
            <DialogTitle>Full Size</DialogTitle>
            {selectedImage && (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Full size"
                  className="max-w-full max-h-[85vh] object-contain"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
