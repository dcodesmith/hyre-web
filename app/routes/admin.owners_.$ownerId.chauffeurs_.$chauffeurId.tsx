import { DocumentType } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { AlertCircle, CheckCircle2, FileText, XCircle } from "lucide-react";
import { useEffect } from "react";
import { Form } from "~/components/CSRFForm";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { useToast } from "~/hooks/use-toast";
import { cn } from "~/lib/utils";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);

  const chauffeur = await prisma.user.findUnique({
    where: {
      id: params.chauffeurId,
      fleetOwnerId: params.ownerId,
    },
    include: {
      fleetOwner: true,
      documents: true,
      bookingsAsChauffeur: {
        where: {
          status: {
            in: ["CONFIRMED", "ACTIVE"],
          },
        },
        take: 1,
        include: {
          car: true,
        },
      },
    },
  });

  if (!chauffeur) {
    throw new Response("Not Found", { status: 404 });
  }

  return { chauffeur };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);
  await requireAdminOrStaffWithRedirect(request);

  const validStatuses = ["APPROVED", "REJECTED", "PENDING"] as const;

  const formData = await request.formData();
  const intent = formData.get("intent");
  const statusValue = formData.get("status");
  const status = validStatuses.includes(statusValue as (typeof validStatuses)[number])
    ? (statusValue as (typeof validStatuses)[number])
    : null;

  if (intent !== "updateApprovalStatus" || !status) {
    return data({ success: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: params.chauffeurId, fleetOwnerId: params.ownerId },
      data: { chauffeurApprovalStatus: status },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating chauffeur approval status:", error);
    return data({ success: false, error: "Failed to update status" }, { status: 500 });
  }
}

const approvalStatusColors = {
  PENDING: "bg-yellow-50 text-yellow-600",
  APPROVED: "bg-green-50 text-green-600",
  REJECTED: "bg-red-50 text-red-600",
};

const approvalStatusIcons = {
  PENDING: AlertCircle,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
};

export default function ChauffeurDetails() {
  const { chauffeur } = useLoaderData<typeof loader>();
  const documents = chauffeur.documents;
  const ninDoc = documents.find(({ documentType }) => documentType === DocumentType.NIN);
  const driversLicenseDoc = documents.find(
    ({ documentType }) => documentType === DocumentType.DRIVERS_LICENSE,
  );
  const currentBooking = chauffeur.bookingsAsChauffeur[0];
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const { toast } = useToast();

  useEffect(() => {
    if (navigation.state === "idle" && actionData) {
      if (actionData.success) {
        toast({
          title: "Success",
          description: "Chauffeur status updated successfully",
          variant: "default",
        });
      } else if (actionData.error) {
        toast({
          title: "Error",
          description: actionData.error,
          variant: "destructive",
        });
      }
    }
  }, [navigation.state, actionData, toast]);

  let status = "AVAILABLE";
  if (currentBooking?.status === "ACTIVE") status = "ON_TRIP";
  else if (currentBooking?.status === "CONFIRMED") status = "ASSIGNED";

  const statusColors: Record<string, string> = {
    AVAILABLE: "bg-green-50 text-green-600",
    ON_TRIP: "bg-blue-50 text-blue-600",
    ASSIGNED: "bg-yellow-50 text-yellow-600",
  };

  const statusText: Record<string, string> = {
    AVAILABLE: "Available",
    ON_TRIP: "On Trip",
    ASSIGNED: "Assigned",
  };

  const approvalStatus = chauffeur.chauffeurApprovalStatus ?? "PENDING";
  const StatusIcon = approvalStatusIcons[approvalStatus];

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold">Chauffeur Details</h1>
            <div className="flex items-center gap-4">
              <Badge
                variant="outline"
                className={cn(
                  approvalStatusColors[approvalStatus],
                  "rounded-full px-3 py-1 flex items-center gap-2",
                )}
              >
                <StatusIcon className="h-4 w-4" />
                {approvalStatus.charAt(0) + approvalStatus.slice(1).toLowerCase()}
              </Badge>
              <div className="flex gap-2">
                <Form method="post">
                  <input type="hidden" name="intent" value="updateApprovalStatus" />
                  {approvalStatus !== "APPROVED" && (
                    <Button
                      type="submit"
                      name="status"
                      value="APPROVED"
                      variant="outline"
                      className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  )}
                  {approvalStatus !== "REJECTED" && (
                    <Button
                      type="submit"
                      name="status"
                      value="REJECTED"
                      variant="outline"
                      className="border-red-600 text-red-600 hover:bg-red-50 ml-2"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  )}
                  {(approvalStatus === "APPROVED" || approvalStatus === "REJECTED") && (
                    <Button
                      type="submit"
                      name="status"
                      value="PENDING"
                      variant="outline"
                      className="ml-2"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Reset to Pending
                    </Button>
                  )}
                </Form>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Name:</span> {chauffeur.name}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {chauffeur.email}
                </p>
                <p>
                  <span className="font-medium">Phone:</span> {chauffeur.phoneNumber}
                </p>
                <p>
                  <span className="font-medium">Address:</span> {chauffeur.address}
                </p>
                <div>
                  <span className="font-medium">Status: </span>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-sm ${statusColors[status]}`}
                  >
                    {statusText[status]}
                  </span>
                </div>
              </div>
            </div>

            {currentBooking && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Current Assignment</h2>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Vehicle:</span> {currentBooking.car.make}{" "}
                    {currentBooking.car.model}
                  </p>
                  <p>
                    <span className="font-medium">Registration:</span>{" "}
                    {currentBooking.car.registrationNumber}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {ninDoc && (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="relative aspect-square cursor-pointer hover:opacity-90 transition-opacity">
                      <img
                        src={ninDoc.documentUrl}
                        alt="National ID Card"
                        className="object-cover w-full h-full rounded"
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <img
                      src={ninDoc.documentUrl}
                      alt="National ID Card"
                      className="w-full h-full object-contain"
                    />
                  </DialogContent>
                </Dialog>
              )}
              {driversLicenseDoc && (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="relative aspect-square cursor-pointer hover:opacity-90 transition-opacity">
                      <img
                        src={driversLicenseDoc.documentUrl}
                        alt="Driver's License"
                        className="object-cover w-full h-full rounded"
                      />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <img
                      src={driversLicenseDoc.documentUrl}
                      alt="Driver's License"
                      className="w-full h-full object-contain"
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {ninDoc && (
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  <a
                    href={ninDoc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-48 hover:opacity-90 transition-opacity"
                  >
                    National ID Card
                  </a>
                </div>
              )}
              {driversLicenseDoc && (
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  <a
                    href={driversLicenseDoc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-48 hover:opacity-90 transition-opacity"
                  >
                    Driver's License
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
