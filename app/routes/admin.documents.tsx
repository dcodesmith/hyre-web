import { type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Car, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { PDFViewer } from "~/components/pdf/PDFViewer";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { getOptimizedImageUrl, getImageSrcSet } from "~/utils/image-optimization";

const DocumentType = {
  MOT_CERTIFICATE: "MOT_CERTIFICATE",
  INSURANCE_CERTIFICATE: "INSURANCE_CERTIFICATE",
  NIN: "NIN",
  DRIVERS_LICENSE: "DRIVERS_LICENSE",
  LASDRI: "LASDRI",
  VEHICLE_IMAGES: "VEHICLE_IMAGES",
  CERTIFICATE_OF_INCORPORATION: "CERTIFICATE_OF_INCORPORATION",
} as const;

const documentTypeMap: Record<(typeof DocumentType)[keyof typeof DocumentType], string> = {
  [DocumentType.MOT_CERTIFICATE]: "MOT Certificate",
  [DocumentType.INSURANCE_CERTIFICATE]: "Insurance Certificate",
  [DocumentType.NIN]: "National Identification Number (NIN)",
  [DocumentType.DRIVERS_LICENSE]: "Driver's License",
  [DocumentType.LASDRI]: "LASDRI Card (Lagos State Drivers' Refresher Institute)",
  [DocumentType.VEHICLE_IMAGES]: "Vehicle Images",
  [DocumentType.CERTIFICATE_OF_INCORPORATION]: "Certificate of Incorporation",
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const [pendingDocuments, pendingVehicleImages] = await Promise.all([
    prisma.documentApproval.findMany({
      where: {
        status: "PENDING",
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
        user: {
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
        status: "PENDING",
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

  return { pendingDocuments, pendingVehicleImages };
}

export default function AdminDocumentsPage() {
  const { pendingDocuments, pendingVehicleImages } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState("documents");
  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean;
    type: "document" | "vehicle-image";
    id: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);

  const documentFetcher = useFetcher();
  const imageFetcher = useFetcher();
  const csrfToken = useAuthenticityToken();

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
      { csrf: csrfToken },
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
                            {documentTypeMap[doc.documentType]} {(() => {
                              if (
                                doc.documentType === DocumentType.NIN ||
                                doc.documentType === DocumentType.DRIVERS_LICENSE ||
                                doc.documentType === DocumentType.LASDRI
                              ) {
                                return `for ${doc.user?.name || "Unknown User"}`;
                              }
                              if (
                                doc.documentType === DocumentType.MOT_CERTIFICATE ||
                                doc.documentType === DocumentType.INSURANCE_CERTIFICATE
                              ) {
                                return `for car [${doc.car.registrationNumber.trim()}]`;
                              }
                              return `for ${doc.car?.make} ${doc.car?.model}`;
                            })()}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Submitted on {new Date(doc.createdAt).toLocaleDateString("en-GB")} by{" "}
                            {doc.car?.owner?.name ||
                              doc.user?.name ||
                              doc.user?.email ||
                              "fleet owner"}
                          </p>
                        </div>

                        {/* View Certificate Button */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <a href={doc.documentUrl} target="_blank" rel="noreferrer">
                              View Document
                            </a>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setPreviewDoc({
                                url: `/api/proxy-pdf/${doc.id}`,
                                title: documentTypeMap[doc.documentType] ?? "Document",
                              })
                            }
                          >
                            Preview
                          </Button>
                        </div>

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
                          src={getOptimizedImageUrl(image.url, { width: 1024 })}
                          srcSet={getImageSrcSet(image.url, 1024)}
                          sizes="(max-width: 768px) 100vw, 1024px"
                          alt={`${image.car.make} ${image.car.model} vehicle`}
                          className="max-w-full h-auto rounded"
                          loading="lazy"
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

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title ?? "Document Preview"}</DialogTitle>
            <DialogDescription>
              Preview the submitted document without leaving the page.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[70vh]">
            {previewDoc?.url ? (
              <PDFViewer fileUrl={previewDoc.url} />
            ) : (
              <p className="text-sm text-gray-500">No document selected.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPreviewDoc(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
