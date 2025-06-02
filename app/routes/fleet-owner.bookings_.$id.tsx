import { BookingStatus, PaymentStatus } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { redirect, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import invariant from "tiny-invariant";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatCurrency, getCustomerDetails, normaliseBookingDetails } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import { renderChauffeurAssignedEmail } from "~/modules/email/templates/booking-notification";
import { format } from "date-fns";
import logger from "~/lib/logger.server";
import { sendMessage, Template } from "~/modules/messaging/messaging.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  try {
    if (request.method !== "PATCH") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    invariant(params.id, "Booking ID is required");

    const formData = await request.formData();
    const chauffeurId = String(formData.get("chauffeurId"));

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: { chauffeurId },
      include: {
        car: { include: { owner: true } },
        legs: { include: { extensions: true } },
        user: true,
        chauffeur: true,
      },
    });

    if (!booking) {
      return json({ error: "Booking not found" }, { status: 404 });
    }

    const { email } = getCustomerDetails(booking);
    const bookingDetails = normaliseBookingDetails(booking);

    await sendMessage({
      templateKey: Template.ChauffeurAssigned,
      variables: {
        "1": bookingDetails.customerName,
        "2": bookingDetails.carName,
        "3": bookingDetails.chauffeurName,
        "4": bookingDetails.chauffeurPhoneNumber,
        "5": bookingDetails.startDate,
        "6": bookingDetails.endDate,
        "7": bookingDetails.pickupLocation,
        "8": bookingDetails.returnLocation,
        "9": bookingDetails.totalAmount,
      },
    });

    await sendEmail({
      to: email,
      subject: "A chauffeur has been assigned to your booking",
      html: await renderChauffeurAssignedEmail(bookingDetails),
    });

    return redirect("/fleet-owner");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    logger.error(errorMessage);
    return json({ error: errorMessage }, { status: 500 });
  }
};

export async function loader({ params }: LoaderFunctionArgs) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: params.id,
      status: {
        in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
      },
      paymentStatus: PaymentStatus.PAID,
    },
    include: {
      chauffeur: true,
      car: {
        include: {
          owner: {
            include: {
              chauffeurs: {
                where: {
                  roles: {
                    some: {
                      name: "chauffeur",
                    },
                  },
                  OR: [
                    {
                      bookingsAsChauffeur: {
                        none: {}, // No bookings assigned
                      },
                    },
                    {
                      bookingsAsChauffeur: {
                        every: {
                          OR: [
                            {
                              status: {
                                notIn: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  return json({ booking });
}

export default function BookingDetails() {
  const { booking } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Booking Details</h2>
        <p className="font-medium">
          {booking.car.make} {booking.car.model} {booking.car.year} - {booking.car.color}
        </p>
      </div>
      <div className="bg-white p-6 space-y-4 border rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-gray-500">Pickup Date</h3>
            <p className="font-medium">{format(booking.startDate, "PPPp")}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Return Date</h3>
            <p className="font-medium">{format(booking.endDate, "PPPp")}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Pickup Location</h3>
            <p className="font-medium">{booking.pickupLocation}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Return Location</h3>
            <p className="font-medium">{booking.returnLocation}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Status</h3>
            <p className="font-medium">{booking.status}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Total Amount</h3>
            <p className="font-medium">{formatCurrency(Number(booking.totalAmount))}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Chauffeur</h3>
            {booking.status === "CONFIRMED" ? (
              booking.chauffeur && !showForm ? (
                <div>
                  <p className="font-medium">{booking.chauffeur.name}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="underline pl-0"
                    onClick={() => setShowForm(true)}
                  >
                    Change Chauffeur
                  </Button>
                </div>
              ) : (
                <fetcher.Form method="patch">
                  {fetcher.data?.error && (
                    <div className="text-sm text-red-600 mb-2">{fetcher.data.error}</div>
                  )}
                  <Select name="chauffeurId">
                    <SelectTrigger>
                      <SelectValue placeholder={booking.chauffeur?.name || "Select a chauffeur"} />
                    </SelectTrigger>
                    <SelectContent>
                      {booking.car.owner.chauffeurs.map((chauffeur) => (
                        <SelectItem key={chauffeur.id} value={chauffeur.id}>
                          {chauffeur.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center mt-2 gap-2">
                    <Button type="submit" disabled={fetcher.state !== "idle"}>
                      {fetcher.state !== "idle" ? "Assigning..." : "Assign Chauffeur"}
                    </Button>
                    {booking.chauffeurId && (
                      <Button
                        type="button"
                        variant="link"
                        className="underline"
                        onClick={() => setShowForm(false)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </fetcher.Form>
              )
            ) : booking.chauffeur ? (
              <p className="font-medium">{booking.chauffeur.name}</p>
            ) : (
              <p className="font-medium text-gray-500">Not assigned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
