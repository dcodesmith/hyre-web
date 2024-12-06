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
import { formatCurrency } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import { renderChauffeurAssignedEmail } from "~/modules/email/templates/booking-notification";

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "PATCH") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  invariant(params.id, "id is required");

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");

  const formData = await request.formData();
  const chauffeurId = String(formData.get("chauffeurId"));

  invariant(startDate, "startDate is required");

  // Check if chauffeur is already assigned to another booking
  const existingBooking = await prisma.booking.findFirst({
    where: {
      chauffeurId,
      status: {
        in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE], // Only check active and confirmed bookings
      },
      startDate: {
        lte: new Date(startDate), // Booking starts before or on this date
      },
      endDate: {
        gte: new Date(startDate), // Booking ends after or on this date
      },
    },
  });

  if (existingBooking) {
    return json(
      {
        error:
          "Chauffeur is already assigned to another booking during this time",
      },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: { chauffeurId },
    include: {
      car: {
        include: {
          owner: true,
        },
      },
      user: true,
      chauffeur: true,
    },
  });

  if (booking === null || booking.user === null || booking.chauffeur === null) {
    return json({ error: "User or chauffeur not found" }, { status: 404 });
  }

  await sendEmail({
    to: booking.user.email,
    subject: "Chauffeur Assigned to Your Booking",
    html: await renderChauffeurAssignedEmail(booking),
  });

  return redirect(`/fleet-owner`);
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");

  invariant(params.id, "id is required");
  invariant(startDate, "startDate is required");

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
                              endDate: {
                                lte: new Date(startDate), // All assigned bookings have ended
                              },
                            },
                            {
                              status: {
                                notIn: [
                                  BookingStatus.CONFIRMED,
                                  BookingStatus.ACTIVE,
                                ],
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
          {booking.car.make} {booking.car.model} {booking.car.year} -{" "}
          {booking.car.color}
        </p>
      </div>
      <div className="bg-white p-6 space-y-4 border rounded overflow-hidden shadow-md hover:shadow-lg transition-shadow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-gray-500">Pickup Date</h3>
            <p className="font-medium">{formatDate(booking.startDate)}</p>
          </div>

          <div>
            <h3 className="text-gray-500">Return Date</h3>
            <p className="font-medium">{formatDate(booking.endDate)}</p>
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
            <p className="font-medium">
              {formatCurrency(Number(booking.totalAmount))}
            </p>
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
                    <div className="text-sm text-red-600 mb-2">
                      {fetcher.data.error}
                    </div>
                  )}
                  <Select name="chauffeurId">
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          booking.chauffeur?.name || "Select a chauffeur"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {booking.car.owner.chauffeurs?.map((chauffeur) => (
                        <SelectItem key={chauffeur.id} value={chauffeur.id}>
                          {chauffeur.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center mt-2 gap-2">
                    <Button type="submit" disabled={fetcher.state !== "idle"}>
                      {fetcher.state !== "idle"
                        ? "Assigning..."
                        : "Assign Chauffeur"}
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
