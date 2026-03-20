import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  data,
  useLoaderData,
  useSubmit,
  useNavigate,
} from "react-router";
import { prisma } from "~/modules/db/db.server"; // Update the import path
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CarApprovalStatus } from "@prisma/client";
import { requireAdminWithRedirect } from "~/modules/auth/auth.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "~/components/ui/dialog";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { getImageSrcSet, getOptimizedImageUrl } from "~/utils/image-optimization";

import { PDFViewer } from "~/components/pdf/PDFViewer";
import { Textarea } from "~/components/ui/textarea";
import { useAuthenticityToken } from "remix-utils/csrf/react";

import invariant from "tiny-invariant";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminWithRedirect(request);

  const { carId, ownerId } = params;

  invariant(carId, "Car ID is required");
  invariant(ownerId, "Owner ID is required");

  const car = await prisma.car.findFirst({
    where: { id: carId, ownerId },
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

  return { car };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminWithRedirect(request);

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "approve") {
    await prisma.car.update({
      where: { id: params.carId, ownerId: params.ownerId },
      data: {
        approvalStatus: "APPROVED",
      },
    });
    return { success: true };
  }

  return data({ success: false, error: "Invalid action" }, { status: 400 });
}

export default function CarDetails() {
  const { car } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();
  const [selectedImage, setSelectedImage] = useState<{ url: string; id: string } | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; title: string; id: string } | null>(
    null,
  );
  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean;
    type: "document" | "image";
    id: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const navigate = useNavigate();
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<string | null>(null);

  const handleApprove = () => {
    if (globalThis.confirm("Are you sure you want to approve this car?")) {
      const formData = new FormData();
      formData.append("action", "approve");
      formData.append("csrf", csrfToken);
      submit(formData, { method: "POST" });
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

  const motCertificate = car.documents.find((doc) => doc.documentType === "MOT_CERTIFICATE");
  const insuranceCertificate = car.documents.find(
    (doc) => doc.documentType === "INSURANCE_CERTIFICATE",
  );

  const getStatusBadgeClass = (status: CarApprovalStatus) => {
    if (status === CarApprovalStatus.APPROVED) return "bg-green-100 text-green-800";
    if (status === CarApprovalStatus.REJECTED) return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

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
            <button
              type="button"
              key={image.id}
              className="relative aspect-square cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedImage({ url: image.url, id: image.id })}
              aria-label={`View ${car.make} ${car.model} image ${index + 1}`}
            >
              <img
                src={getOptimizedImageUrl(image.url, { width: 320 })}
                srcSet={getImageSrcSet(image.url, 320)}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 320px"
                alt={`${car.make} ${car.model} - ${index + 1}`}
                className="object-cover w-full h-full"
                width="320"
                height="320"
                loading="lazy"
              />
              <div
                className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(image.status)}`}
              >
                {image.status}
              </div>
            </button>
          ))}
        </div>

        <h2 className="text-lg font-medium mt-8 mb-4">
          Certificates{" "}
          <span className="text-sm text-gray-500">
            (Click each certificate to review and approve or reject)
          </span>
        </h2>
        <ul className="space-y-2">
          {motCertificate && (
            <li className="flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              <Button
                variant="ghost"
                onClick={() =>
                  setSelectedPdf({
                    url: `/api/proxy-pdf/${motCertificate.id}`,
                    id: motCertificate.id,
                    title: "MOT Certificate",
                  })
                }
                className="hover:bg-transparent p-0 h-auto"
              >
                MOT Certificate
                {motCertificate.status === "APPROVED" && (
                  <CheckCircle2 className="w-4 h-4 text-green-600 ml-2" />
                )}
              </Button>
            </li>
          )}

          {insuranceCertificate && (
            <li className="flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              <Button
                variant="ghost"
                onClick={() =>
                  setSelectedPdf({
                    url: `/api/proxy-pdf/${insuranceCertificate.id}`,
                    id: insuranceCertificate.id,
                    title: "Insurance Certificate",
                  })
                }
                className="hover:bg-transparent p-0 h-auto"
              >
                Insurance Certificate
                {insuranceCertificate.status === "APPROVED" && (
                  <CheckCircle2 className="w-4 h-4 text-green-600 ml-2" />
                )}
              </Button>
            </li>
          )}
        </ul>

        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-[90vw] w-fit h-fit max-h-[90vh] p-0 flex flex-col items-center justify-center border bg-white">
            <DialogTitle className="p-4">Vehicle Image</DialogTitle>
            {selectedImage && (
              <>
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img
                    src={selectedImage.url}
                    alt="Full size"
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                </div>
                <DialogFooter className="w-full p-4 border-t bg-white">
                  <Button variant="outline" onClick={() => setSelectedImage(null)}>
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isRejecting === selectedImage.id}
                    onClick={() => {
                      setSelectedImage(null);
                      setRejectionModal({
                        open: true,
                        type: "image",
                        id: selectedImage.id,
                      });
                      setRejectionReason("");
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    disabled={isApproving === selectedImage.id}
                    onClick={async () => {
                      setIsApproving(selectedImage.id);
                      try {
                        const response = await fetch(
                          `/admin/vehicle-images/${selectedImage.id}/approve`,
                          {
                            headers: { "X-CSRF-Token": csrfToken },
                            credentials: "same-origin",
                            method: "POST",
                          },
                        );

                        if (response.ok) {
                          setSelectedImage(null);
                          navigate(".", { replace: true });
                        }
                      } catch (error) {
                        console.error("Error approving image:", error);
                      } finally {
                        setIsApproving(null);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isApproving === selectedImage.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Approve
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedPdf} onOpenChange={() => setSelectedPdf(null)}>
          <DialogContent className="max-w-[90vw] h-[90vh] overflow-hidden flex flex-col">
            <DialogTitle className="mb-0">{selectedPdf?.title || "Document Viewer"}</DialogTitle>
            {selectedPdf && (
              <>
                <div className="flex-1 w-full h-[calc(86vh-8rem)] mt-2">
                  <PDFViewer fileUrl={selectedPdf.url} />
                </div>
                <DialogFooter className="mt-4 pb-4">
                  <Button variant="outline" onClick={() => setSelectedPdf(null)}>
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const documentId = selectedPdf.id;
                      setSelectedPdf(null);
                      setRejectionModal({
                        open: true,
                        type: "document",
                        id: documentId,
                      });
                      setRejectionReason("");
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={async () => {
                      const documentId = selectedPdf.id;
                      try {
                        const response = await fetch(`/admin/documents/${documentId}/approve`, {
                          method: "POST",
                          headers: { "X-CSRF-Token": csrfToken },
                          credentials: "same-origin",
                        });
                        if (response.ok) {
                          setSelectedPdf(null);
                          navigate(".", { replace: true });
                        }
                      } catch (error) {
                        console.error("Error approving document:", error);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Approve
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={rejectionModal?.open}
          onOpenChange={(open) => !open && setRejectionModal(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Reject {rejectionModal?.type === "document" ? "Document" : "Vehicle Image"}
              </DialogTitle>
              <DialogDescription>
                Please provide a reason for rejection. This will be sent to the user.
              </DialogDescription>
            </DialogHeader>

            <form
              method="post"
              action={
                rejectionModal?.type === "document"
                  ? `/admin/documents/${rejectionModal?.id}/reject`
                  : `/admin/vehicle-images/${rejectionModal?.id}/reject`
              }
              onSubmit={async (e) => {
                e.preventDefault();
                if (rejectionModal?.id) {
                  setIsRejecting(rejectionModal.id);
                  try {
                    const formData = new FormData(e.currentTarget);
                    const response = await fetch(e.currentTarget.action, {
                      method: "POST",
                      headers: { "X-CSRF-Token": csrfToken },
                      credentials: "same-origin",
                      body: formData,
                    });

                    if (response.ok) {
                      setRejectionModal(null);
                      setRejectionReason("");
                      navigate(".", { replace: true });
                    }
                  } catch (error) {
                    console.error("Error rejecting item:", error);
                  } finally {
                    setIsRejecting(null);
                  }
                }
              }}
            >
              <div className="py-4">
                <Textarea
                  name="notes"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className="min-h-[100px]"
                  required
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectionModal(null)}
                  disabled={!!isRejecting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={!!isRejecting}>
                  {isRejecting === rejectionModal?.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Reject
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
