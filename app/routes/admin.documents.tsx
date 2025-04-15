import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { DocumentStatus, DocumentType } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { requireUserWithRole } from "~/modules/auth/auth.server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { FileText, Car } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, "admin");

  const [pendingDocuments, pendingVehicleImages] = await Promise.all([
    prisma.documentApproval.findMany({
      where: {
        status: DocumentStatus.PENDING,
      },
      include: {
        car: {
          select: {
            id: true,
            make: true,
            model: true,
            registrationNumber: true,
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        chauffeur: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.vehicleImage.findMany({
      where: {
        status: DocumentStatus.PENDING,
      },
      include: {
        car: {
          select: {
            id: true,
            make: true,
            model: true,
            registrationNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return json({ pendingDocuments, pendingVehicleImages });
}

const isDocumentLink = (type: DocumentType) =>
  type === DocumentType.MOT_CERTIFICATE || type === DocumentType.INSURANCE_CERTIFICATE;

const documentTypeMap: Record<DocumentType, string> = {
  [DocumentType.MOT_CERTIFICATE]: "MOT Certificate",
  [DocumentType.INSURANCE_CERTIFICATE]: "Insurance Certificate",
  [DocumentType.NIN]: "National Identification Number (NIN)",
  [DocumentType.DRIVERS_LICENSE]: "Driver's License",
  [DocumentType.VEHICLE_IMAGES]: "Vehicle Images",
};

export default function AdminDocumentsPage() {
  const { pendingDocuments, pendingVehicleImages } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState("documents");
  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean;
    type: "document" | "vehicle-image";
    id: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const documentFetcher = useFetcher();
  const imageFetcher = useFetcher();

  // Track which items are being approved
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  // Update approvingIds when a fetcher starts/completes
  useEffect(() => {
    if (documentFetcher.state === "submitting") {
      // Get the documentId from the submission URL instead
      const urlParts = documentFetcher.submission?.action.split("/");
      const documentId = urlParts?.[urlParts.length - 2]; // Get the ID from the URL
      if (documentId) {
        setApprovingIds((prev) => new Set([...prev, documentId]));
      }
    } else if (documentFetcher.state === "idle" && documentFetcher.data?.success) {
      const approvedId = documentFetcher.data.document.id;
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(approvedId);
        return next;
      });
    }
  }, [documentFetcher.state, documentFetcher.data, documentFetcher.submission]);

  // Handle document approval
  const handleDocumentApproval = (documentId: string) => {
    documentFetcher.submit(
      {}, // Empty object since we don't need to send any data
      {
        method: "post",
        action: `/admin/documents/${documentId}/approve`,
      },
    );
  };

  const [images, setImages] = useState(pendingVehicleImages);

  // Update images when loader data changes
  useEffect(() => {
    setImages(pendingVehicleImages);
  }, [pendingVehicleImages]);

  // Update images optimistically when fetcher returns data
  useEffect(() => {
    if (imageFetcher.data?.success && imageFetcher.data?.image) {
      setImages((prevImages) => prevImages.filter((img) => img.id !== imageFetcher.data.image.id));
    }
  }, [imageFetcher.data]);

  const handleImageApproval = (imageId: string) => {
    imageFetcher.submit(
      {},
      {
        method: "post",
        action: `/admin/vehicle-images/${imageId}/approve`,
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Document Approvals</h1>

      <Tabs defaultValue="documents" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="documents" className="relative">
            Documents
            {pendingDocuments.length > 0 && (
              <span className="ml-2 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">
                {pendingDocuments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="images" className="relative">
            Vehicle Images
            {pendingVehicleImages.length > 0 && (
              <span className="ml-2 bg-indigo-100 text-indigo-600 py-0.5 px-2 rounded-full text-xs">
                {pendingVehicleImages.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <section>
            <h2 className="text-xl font-semibold mb-4">Document Approvals</h2>
            {pendingDocuments.length === 0 ? (
              <p className="text-gray-500">No pending documents to review.</p>
            ) : (
              <div className="grid gap-6">
                {pendingDocuments
                  .filter(
                    (doc) =>
                      !documentFetcher.data?.success || doc.id !== documentFetcher.data.document.id,
                  )
                  .map((doc) => (
                    <div key={doc.id} className="gap-4">
                      <div className="space-y-4">
                        {/* Document Header */}
                        <div className="space-y-2">
                          <h3 className="text-base font-medium">
                            {documentTypeMap[doc.documentType]} for {doc.car?.make} {doc.car?.model}{" "}
                            [{doc.car?.registrationNumber}]
                          </h3>
                          <p className="text-sm text-gray-600">
                            Submitted on {new Date(doc.createdAt).toLocaleDateString("en-GB")} by{" "}
                            {doc.car?.owner?.name || "fleet owner"}
                          </p>
                        </div>

                        {/* View Certificate Button */}
                        {isDocumentLink(doc.documentType) && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <a href={doc.documentUrl} target="_blank" rel="noreferrer">
                              View Certificate
                            </a>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="default"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleDocumentApproval(doc.id)}
                            disabled={approvingIds.has(doc.id)}
                          >
                            {approvingIds.has(doc.id) ? "Approving..." : "Approve"}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setRejectionModal({
                                open: true,
                                type: "document",
                                id: doc.id,
                              });
                              setRejectionReason("");
                            }}
                            disabled={approvingIds.has(doc.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="images">
          <section>
            <h2 className="text-xl font-semibold mb-4">Vehicle Images</h2>
            {images.length === 0 ? (
              <p className="text-gray-500">No pending vehicle images to review.</p>
            ) : (
              <div className="grid gap-6">
                {images
                  .filter(
                    (img) => !imageFetcher.data?.success || img.id !== imageFetcher.data.image.id,
                  )
                  .map((image) => (
                    <div key={image.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Car className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">Vehicle Image</h2>
                          </div>
                          <p className="text-sm text-gray-500">
                            Submitted on {new Date(image.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            onClick={() => handleImageApproval(image.id)}
                            disabled={approvingIds.has(image.id)}
                          >
                            {approvingIds.has(image.id) ? "Approving..." : "Approve"}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setRejectionModal({
                                open: true,
                                type: "vehicle-image",
                                id: image.id,
                              });
                              setRejectionReason("");
                            }}
                            disabled={approvingIds.has(image.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div>
                          <p>
                            {image.car.make} {image.car.model}
                          </p>
                          <p>Registration: {image.car.registrationNumber}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <img
                          src={image.url}
                          alt={`${image.car.make} ${image.car.model} vehicle`}
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={rejectionModal?.open} onOpenChange={(open) => !open && setRejectionModal(null)}>
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
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              form.submit();
              setRejectionModal(null);
              setRejectionReason("");
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
              <Button type="button" variant="outline" onClick={() => setRejectionModal(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Reject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
