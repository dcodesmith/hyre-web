import { BookingStatus, PaymentStatus } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { format } from "date-fns";
import invariant from "tiny-invariant";
import { ChauffeurSection } from "~/components/booking/ChauffeurSection";
import logger from "~/lib/logger.server";
import { formatCurrency, getCustomerDetails, normaliseBookingDetails } from "~/lib/utils";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { sendEmail } from "~/modules/email/email.server";
import { renderChauffeurAssignedEmail } from "~/modules/email/templates/booking-notification";
import { Template, sendMessage } from "~/modules/messaging/messaging.server";
import { validateCSRF } from "~/utils/csrf-action.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  await validateCSRF(request);

  const user = await requireUser(request);

  try {
    if (request.method !== "PATCH") {
      return data({ error: "Method not allowed" }, { status: 405 });
    }

    invariant(params.id, "Booking ID is required");

    const formData = await request.formData();
    const chauffeurIdRaw = formData.get("chauffeurId");

    if (typeof chauffeurIdRaw !== "string" || !chauffeurIdRaw) {
      return data({ error: "chauffeurId is required" }, { status: 400 });
    }
    const chauffeurId = chauffeurIdRaw;

    const existing = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { car: { select: { ownerId: true } } },
    });

    if (!existing) {
      return data({ error: "Booking not found" }, { status: 404 });
    }

    if (existing.car.ownerId !== user.id) {
      return data({ error: "Booking does not belong to this fleet owner" }, { status: 403 });
    }

    const validChauffeur = await prisma.user.findFirst({
      where: {
        id: chauffeurId,
        fleetOwnerId: existing.car.ownerId,
        roles: { some: { name: "chauffeur" } },
        bookingsAsChauffeur: {
          none: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACTIVE] } },
        },
      },
    });

    if (!validChauffeur) {
      return data({ error: "Invalid chauffeur for this booking" }, { status: 400 });
    }

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: { chauffeurId },
      include: {
        car: { include: { owner: { include: { chauffeurs: true } } } },
        legs: { include: { extensions: true } },
        user: true,
        chauffeur: true,
      },
    });

    if (!booking) {
      return data({ error: "Booking not found" }, { status: 404 });
    }

    const { email } = getCustomerDetails(booking);
    const bookingDetails = normaliseBookingDetails(booking);

    if (bookingDetails.customerPhoneNumber) {
      await sendMessage({
        templateKey: Template.ChauffeurAssigned,
        to: bookingDetails.customerPhoneNumber,
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
    }

    if (booking.chauffeur?.phoneNumber) {
      await sendMessage({
        templateKey: Template.ChauffeurBookingNotification,
        to: booking.chauffeur.phoneNumber,
        variables: {
          "1": bookingDetails.chauffeurName,
          "2": bookingDetails.carName,
          "3": bookingDetails.startDate,
          "4": bookingDetails.endDate,
          "5": bookingDetails.pickupLocation,
          "6": bookingDetails.returnLocation,
        },
      });
    }

    await sendEmail({
      to: email,
      subject: "A chauffeur has been assigned to your booking",
      html: await renderChauffeurAssignedEmail(bookingDetails),
    });

    return redirect("/fleet-owner");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    logger.error(errorMessage);
    return data({ error: errorMessage }, { status: 500 });
  }
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const booking = await prisma.booking.findUnique({
    where: {
      id: params.id,
      car: { ownerId: user.id },
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
    throw data({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.car.ownerId !== user.id) {
    throw data({ error: "Forbidden" }, { status: 403 });
  }

  return { booking };
}

export default function BookingDetails() {
  const { booking } = useLoaderData<typeof loader>();

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
            <ChauffeurSection booking={booking} />
          </div>
        </div>
      </div>
    </div>
  );
}
