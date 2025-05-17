import {
  isSameDay,
  startOfDay,
  getHours,
  getMinutes,
  set,
  addDays,
  addHours,
  min,
  format,
  getSeconds,
  getMilliseconds,
  differenceInHours,
  parseISO,
} from "date-fns";
import type { User } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import invariant from "tiny-invariant";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePayment } from "~/hooks/usePayment";
import { formatCurrency } from "~/lib/utils";
import { requireUserWithRole } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { upsertExtension } from "~/services/extensions.server";
import logger from "~/lib/logger.server";
import { emailQueue } from "~/queues/email-throttle.server";
import { sendEmail } from "~/modules/email/email.server";
import { bookingExtensionConfirmationEmail } from "~/modules/email/templates/booking-notification";

export async function loader({ params, request }: LoaderFunctionArgs) {
  invariant(params.id, "Booking ID route parameter is required");
  logger.info(`Starting loader for booking ID: ${params.id}`);

  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");
  const now = new Date();
  const today = startOfDay(now); // Midnight today

  const booking = await prisma.booking.findUnique({
    where: { id: params.id, status: "ACTIVE" },
    include: { car: true, user: true, extensions: true },
  });

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  const bookingStartDate = parseISO(booking.startDate.toISOString());
  const bookingEndDate = parseISO(booking.endDate.toISOString());

  // --- User Authentication & Authorization ---
  let user: { email: string; name?: string; phoneNumber?: string } | null | User = null;

  try {
    if (guestEmail) {
      if (!booking.guestUser || (booking.guestUser as { email: string }).email !== guestEmail)
        throw new Response("Unauthorized guest access", { status: 403 });
      user = booking.guestUser as { email: string; name?: string; phoneNumber?: string };
      logger.info(`Guest user authorized: ${guestEmail}`);
    } else {
      const loggedInUser = await requireUserWithRole(request, "user");
      if (loggedInUser.id !== booking.userId)
        throw new Response("Booking does not belong to this user", { status: 403 });
      user = loggedInUser;
      logger.info(`Logged-in user authorized: ${loggedInUser.id}`);
    }
  } catch (authError: unknown) {
    logger.error(`Auth error: ${authError}`);
    if (authError instanceof Response) throw authError;
    throw new Response("Authentication required or invalid permissions", { status: 401 });
  }

  if (now < bookingStartDate || now >= bookingEndDate) {
    logger.warn(
      `Current time ${now.toISOString()} is outside booking period ${bookingStartDate.toISOString()} - ${bookingEndDate.toISOString()}.`,
    );

    throw new Response("Booking is not within its scheduled start and end dates.", { status: 400 });
  }

  logger.info(`Booking ${booking.id} is ACTIVE and within overall time frame.`);

  // --- Calculate Current State for Today, considering existing extensions ---
  const isMultiDay = !isSameDay(bookingStartDate, bookingEndDate);

  let effectiveOriginalEndTimeToday: Date;

  if (isSameDay(today, bookingEndDate)) {
    effectiveOriginalEndTimeToday = bookingEndDate;
  } else {
    effectiveOriginalEndTimeToday = set(today, {
      hours: getHours(bookingEndDate),
      minutes: getMinutes(bookingEndDate),
      seconds: getSeconds(bookingEndDate),
      milliseconds: getMilliseconds(bookingEndDate),
    });
  }

  const existingExtensionToday = await prisma.extension.findUnique({
    where: { bookingId_day: { bookingId: booking.id, day: today } },
    select: { id: true, endDate: true },
  });

  let currentEndTimeToday: Date;
  if (existingExtensionToday?.endDate) {
    currentEndTimeToday = new Date(existingExtensionToday.endDate);
    logger.info(
      `Existing extension (ID: ${existingExtensionToday.id}) found for today. Current end time is now ${currentEndTimeToday.toISOString()}.`,
    );
  } else {
    currentEndTimeToday = effectiveOriginalEndTimeToday;
    logger.info(
      `No existing extension for today, or endDate missing on existing. Current end time is original: ${currentEndTimeToday.toISOString()}.`,
    );
  }
  // Since no extension exists yet for today, current end time IS the original end time
  // const currentEndTimeToday = effectiveOriginalEndTimeToday; // Old logic replaced by above
  logger.info(
    `Calculated current end time for today (after considering extensions): ${currentEndTimeToday.toISOString()}`,
  );

  if (now >= currentEndTimeToday) {
    logger.warn(
      `Current time ${now.toISOString()} is past today's effective end time ${currentEndTimeToday.toISOString()}.`,
    );
    // Custom message if an extension already existed
    const message = existingExtensionToday
      ? "The extended time for today has already ended. Cannot extend further."
      : "The active time for today has already ended. Cannot extend.";

    throw new Response(message, { status: 400 });
  }

  // --- Calculate Max Extension Limit for Today (maxEndToday) ---
  let maxEndToday: Date;

  const nextSeparateBooking = await prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      carId: booking.carId,
      startDate: { gt: currentEndTimeToday },
      status: { in: ["CONFIRMED", "ACTIVE"] },
    },
    orderBy: { startDate: "asc" },
  });

  const nextBookingStartTime = nextSeparateBooking ? new Date(nextSeparateBooking.startDate) : null;
  const hardLimit = startOfDay(addDays(today, 1)); // Midnight next day

  logger.info(`Hard limit for extension: ${hardLimit.toISOString()}`);

  if (nextBookingStartTime) {
    logger.info(`Next separate booking starts: ${nextBookingStartTime.toISOString()}`);
  }

  // *** SCOPE FIX: Declare effectiveStartTimeNextDay with wider scope ***
  let effectiveStartTimeNextDay: Date | null = null;
  let nextSegmentStart: Date; // Will hold the actual start constraint for next segment

  if (!isMultiDay || isSameDay(today, bookingEndDate)) {
    // Case 1: Single-Day or Last Day
    const potentialLimits = [hardLimit];
    if (nextBookingStartTime) potentialLimits.push(nextBookingStartTime);
    maxEndToday = min(potentialLimits);
    logger.info(
      `Type: Single/Last Day. Max end determined by: ${maxEndToday === hardLimit ? "Hard Limit" : "Next Booking"}`,
    );
    nextSegmentStart = bookingEndDate; // Set for consistency, though not used as limit here
  } else {
    // Case 2: Multi-Day Intermediate Day
    const startOfNextBookingDay = addDays(today, 1);
    // Fix time zone issue by ensuring consistent parsing
    effectiveStartTimeNextDay = set(startOfNextBookingDay, {
      hours: getHours(bookingStartDate),
      minutes: getMinutes(bookingStartDate),
      seconds: 0,
      milliseconds: 0,
    });
    // Calculate the actual start of the next segment (could be final end date)
    nextSegmentStart = min([effectiveStartTimeNextDay, bookingEndDate]);
    logger.info(`Next segment of this booking starts: ${nextSegmentStart.toISOString()}`);

    // Use nextSegmentStart as the limit from this booking
    const potentialLimits = [nextSegmentStart, hardLimit];
    if (nextBookingStartTime) potentialLimits.push(nextBookingStartTime);
    maxEndToday = min(potentialLimits);
    logger.info(
      `Type: Multi-Day Intermediate. Max end determined by earliest of: Next Segment (${nextSegmentStart.toISOString()}), Hard Limit (${hardLimit.toISOString()}), Next Booking (${nextBookingStartTime?.toISOString() ?? "N/A"})`,
    );
  }
  logger.info(`Calculated max end time for today: ${maxEndToday.toISOString()}`);

  // --- Calculate max hours ---
  // Use differenceInHours for cleaner calculation of full hours
  const maxHours = differenceInHours(maxEndToday, currentEndTimeToday);
  // Ensure maxHours is not negative if calculation resulted in past time somehow
  const validMaxHours = maxHours > 0 ? maxHours : 0;
  logger.info(`Calculated max extension hours: ${validMaxHours}`);

  // Check uses the result (validMaxHours)
  if (validMaxHours < 1) {
    // let reason = "The maximum extension limit for today has been reached."; // Old base
    let reasonDetail = "";
    // --- FIX: Check against nextSegmentStart and add null check for effectiveStartTimeNextDay ---
    // Determine the most restrictive limit that defined maxEndToday
    if (nextBookingStartTime && maxEndToday.getTime() === nextBookingStartTime.getTime()) {
      reasonDetail = `Another booking starts at ${format(nextBookingStartTime, "p")}.`;
    } else if (
      isMultiDay &&
      !isSameDay(today, bookingEndDate) &&
      effectiveStartTimeNextDay && // Ensure this is defined for multi-day intermediate
      maxEndToday.getTime() === nextSegmentStart.getTime()
    ) {
      reasonDetail = `The next segment of your booking starts at ${format(nextSegmentStart, "p")}.`;
    } else if (maxEndToday.getTime() === hardLimit.getTime()) {
      reasonDetail = "The daily extension limit (midnight) has been reached.";
    } else if (maxEndToday < currentEndTimeToday) {
      reasonDetail = "The calculated extension window is in the past.";
    } else {
      // This covers cases where currentEndTimeToday is too close to maxEndToday for a full hour,
      // or maxEndToday is slightly ahead but not enough.
      reasonDetail = "The remaining time is less than a full hour.";
    }

    const baseMessage = existingExtensionToday
      ? "No further extension is possible today."
      : "Extension is not possible today.";
    const fullMessage = `${baseMessage} ${reasonDetail}`;

    logger.warn(
      `Max hours < 1. Current end: ${currentEndTimeToday.toISOString()}, Max end: ${maxEndToday.toISOString()}. Reason: ${fullMessage}`,
    );
    throw new Response(fullMessage, { status: 400 });
  }

  // --- Return Data ---
  logger.info(`Loader finished successfully. Max hours: ${maxHours}`);
  return json({
    booking: {
      ...booking,
      currentEndDateDisplay: format(currentEndTimeToday, "PPPp"),
      user,
    },
    maxHours: validMaxHours,
  });
}

// --- ACTION ---
/**
 * Handles the form submission to create an extension after payment confirmation.
 * Validates the request, creates the Extension record, and updates the Booking record.
 * Prevents duplicate extensions for the same day using the unique constraint.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  invariant(params.id, "Booking ID route parameter is required");
  logger.info(`Starting action for booking ID: ${params.id}`);

  const formData = await request.formData();
  const hours = Number(formData.get("hours"));
  const paymentId = String(formData.get("paymentId"));

  // --- Input Validation ---
  if (!paymentId) {
    logger.error("Missing paymentId.");
    return json({ error: "Payment information is missing" }, { status: 400 });
  }
  if (!hours || hours < 1 || !Number.isInteger(hours)) {
    logger.error(`Invalid hours value: ${hours}`);
    return json({ error: "Please select a valid number of hours." }, { status: 400 });
  }
  logger.info(`Inputs - Hours: ${hours}, PaymentID: ${paymentId}`);

  // --- Recalculate Booking State & Validate Request ---
  const now = new Date();
  const today = startOfDay(now);

  let booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { car: true, user: true, extensions: true },
  });

  if (!booking || !booking.startDate || !booking.endDate || !booking.car) {
    // Ensure car is loaded
    logger.error(`Booking not found or invalid (or car missing): ${params.id}`);
    return json({ error: "Booking not found or invalid" }, { status: 404 });
  }

  // Re-check authorization if needed (assuming loader handled initial auth)
  // ...

  // --- Determine Current End Time for Today (accounting for existing extensions) ---
  const bookingStartDate = parseISO(booking.startDate.toISOString());
  const bookingEndDate = parseISO(booking.endDate.toISOString());

  let effectiveOriginalEndTimeToday: Date;
  if (isSameDay(today, bookingEndDate)) {
    effectiveOriginalEndTimeToday = bookingEndDate;
  } else {
    effectiveOriginalEndTimeToday = set(today, {
      hours: getHours(bookingEndDate),
      minutes: getMinutes(bookingEndDate),
      seconds: getSeconds(bookingEndDate),
      milliseconds: getMilliseconds(bookingEndDate),
    });
  }

  const existingExtensionForToday = await prisma.extension.findUnique({
    where: { bookingId_day: { bookingId: booking.id, day: today } },
    select: { id: true, endDate: true, hours: true }, // Select necessary fields
  });

  const currentEndTimeTodayForActionBase = existingExtensionForToday?.endDate
    ? parseISO(existingExtensionForToday.endDate.toISOString()) // Ensure it's a Date object and consistent parsing
    : effectiveOriginalEndTimeToday;

  // --- Re-check Eligibility (status and time) ---
  if (booking.status !== "ACTIVE" || now >= currentEndTimeTodayForActionBase) {
    logger.warn(
      `Eligibility check failed (action): Status ${booking.status}, Now ${now.toISOString()}, Today's Effective End ${currentEndTimeTodayForActionBase.toISOString()}`,
    );
    const message =
      now >= currentEndTimeTodayForActionBase
        ? "The allowed time for extension today has already passed."
        : "Booking is no longer eligible for extension.";
    return json({ error: message }, { status: 400 });
  }
  logger.info(
    `Booking ${booking.id} is eligible. Current effective end for today: ${currentEndTimeTodayForActionBase.toISOString()}`,
  );

  // --- Recalculate maxHours for validation (based on currentEndTimeTodayForActionBase) ---
  const isMultiDay = !isSameDay(bookingStartDate, bookingEndDate);
  const nextSeparateBooking = await prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      carId: booking.carId,
      startDate: { gt: currentEndTimeTodayForActionBase }, // Use the true current end time
      status: { in: ["CONFIRMED", "ACTIVE"] },
    },
    orderBy: { startDate: "asc" },
  });
  const nextBookingStartTime = nextSeparateBooking
    ? parseISO(nextSeparateBooking.startDate.toISOString())
    : null;
  const hardLimit = startOfDay(addDays(today, 1));
  let maxEndToday: Date;
  let effectiveStartTimeNextDay: Date | null = null;
  let nextSegmentStart: Date;

  if (!isMultiDay || isSameDay(today, bookingEndDate)) {
    const potentialLimits = [hardLimit];
    if (nextBookingStartTime) potentialLimits.push(nextBookingStartTime);
    maxEndToday = min(potentialLimits);
    nextSegmentStart = bookingEndDate;
  } else {
    const startOfNextBookingDay = addDays(today, 1);
    effectiveStartTimeNextDay = set(startOfNextBookingDay, {
      hours: getHours(bookingStartDate), // Uses original booking START time for next day's segment start
      minutes: getMinutes(bookingStartDate),
      seconds: 0,
      milliseconds: 0,
    });
    nextSegmentStart = min([effectiveStartTimeNextDay, bookingEndDate]);
    const potentialLimits = [nextSegmentStart, hardLimit];
    if (nextBookingStartTime) potentialLimits.push(nextBookingStartTime);
    maxEndToday = min(potentialLimits);
  }
  // Use differenceInHours for cleaner calculation of full hours
  const maxHoursRecalculated = differenceInHours(maxEndToday, currentEndTimeTodayForActionBase);
  const validMaxHoursRecalculated = maxHoursRecalculated > 0 ? maxHoursRecalculated : 0;

  logger.info(
    `Recalculated maxHours for validation (action): ${validMaxHoursRecalculated}. Max end today: ${maxEndToday.toISOString()}`,
  );

  // --- Final Validation: Submitted hours vs recalculated max ---
  if (hours > validMaxHoursRecalculated) {
    logger.warn(`Submitted hours (${hours}) exceeds max allowed (${validMaxHoursRecalculated}).`);
    return json(
      {
        error: `Cannot extend by ${hours} hours. Maximum currently available is ${validMaxHoursRecalculated} hour(s). Please refresh or try again.`,
      },
      { status: 400 },
    );
  }

  // --- Calculate New End Date for Extension and Cost for THIS transaction ---
  const newProposedEndDateForDay = addHours(currentEndTimeTodayForActionBase, hours);
  const costForThisExtension = booking.car.hourlyRate * hours;
  logger.info(
    `Calculated new proposed end date for today's extension: ${newProposedEndDateForDay.toISOString()}`,
  );
  logger.info(`Calculated cost for this transaction: ${costForThisExtension}`);

  // --- Perform Database Updates (Upsert Extension, Update Booking) ---
  try {
    if (existingExtensionForToday) {
      logger.info(
        `Updating existing extension ${existingExtensionForToday.id} for booking ${booking.id}`,
      );
    } else {
      logger.info(`Creating new extension for booking ${booking.id}`);
    }

    // 1. Upsert Extension Record
    await upsertExtension({
      extensionId: existingExtensionForToday?.id,
      bookingId: booking.id,
      hours: hours,
      day: today,
      originalEndDate: booking.endDate,
      paymentId,
      totalAmount: costForThisExtension,
      endDate: newProposedEndDateForDay,
    });

    if (existingExtensionForToday) {
      logger.info(`Successfully updated extension ${existingExtensionForToday.id}`);
    } else {
      logger.info(`Successfully created new extension for booking ${booking.id}`);
    }

    // 2. Conditionally Update the main Booking record
    const bookingUpdateData: { totalAmount: { increment: number }; endDate?: Date } = {
      totalAmount: { increment: costForThisExtension }, // Always increment cost
    };

    if (!isMultiDay) {
      // Only update the main booking's final endDate if it's a single-day booking
      bookingUpdateData.endDate = newProposedEndDateForDay;
      logger.info("Single-day booking: Updated booking final endDate.");
    } else {
      logger.info("Multi-day booking: Main booking endDate remains unchanged by this extension.");
    }

    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: bookingUpdateData,
      include: { car: true, user: true, extensions: true },
    });
    logger.info(`Successfully updated booking ${booking.id}.`);
  } catch (e: unknown) {
    logger.error(
      `Database operation failed during extension for booking ${booking.id}: ${e instanceof Error ? e.message : "Unknown error"}`,
    );
    // More generic error now, as P2002 should be pre-empted by the if/else logic
    return json(
      { error: "Failed to save extension details. Please contact support." },
      { status: 500 },
    );
  }

  // --- Redirect User ---
  let redirectUrl = `/bookings/${booking.id}`;
  // Fix for linter: Property 'email' does not exist on type 'string | number | boolean | JsonObject | JsonArray'.
  const guestUserData = booking.guestUser as { email?: string; [key: string]: any } | null;
  const guestUserEmail =
    guestUserData && typeof guestUserData.email === "string" ? guestUserData.email : undefined;

  if (guestUserEmail) redirectUrl += `?email=${encodeURIComponent(guestUserEmail)}`;

  const extensionConfirmationHtml = await bookingExtensionConfirmationEmail(booking);

  logger.info(JSON.stringify(booking, null, 2));

  await emailQueue.add(() =>
    sendEmail({
      to: booking.user?.email ?? guestUserEmail,
      subject: "Booking Extension Confirmation",
      html: extensionConfirmationHtml,
    }),
  );
  logger.info(`Sent booking extension confirmation email for booking ${booking.id}.`);

  logger.info(`Extension successful for booking ${booking.id}. Redirecting to ${redirectUrl}`);
  return redirect(redirectUrl);
}

export default function ExtendBookingPage() {
  const { booking, maxHours } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  // Initialize state correctly, ensuring hours doesn't exceed maxHours if maxHours is less than 1 initially
  const [hours, setHours] = useState(maxHours >= 1 ? 1 : 0);

  // Ensure calculations handle potentially 0 hours selected
  const hourlyRate = booking.car.hourlyRate ?? 0; // Handle potential null/undefined rate
  const total = hourlyRate * hours;
  const vat = total * 0.075; // Use your actual VAT calculation logic/rate
  const totalWithVat = total + vat;

  const user = booking.user; // User details from loader

  // Memoize payment handler options if necessary, especially if user object changes reference
  const handlePayment = usePayment({
    totalCost: totalWithVat,
    customer: {
      email: user?.email || "",
      phone_number: user?.phoneNumber || "",
      name: user?.name || "",
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hours <= 0) return; // Don't submit if 0 hours
    const formData = new FormData(event.currentTarget);
    // Ensure 'hours' value from state is correctly represented in formData if needed by handlePayment
    // formData.set('hours', hours.toString()); // Usually handled by the input's name attribute
    await handlePayment(formData, `/bookings/${booking.id}/extend`); // Pass the action URL
  };

  return (
    <div className="max-w-md mx-auto mt-8 bg-white p-6 rounded border overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      {/* Page Title */}
      <h1 className="font-semibold text-base mb-4">
        {" "}
        Extend Booking for {booking.car.make} {booking.car.model} ({booking.car.year}){" "}
      </h1>

      {/* Booking Info Section */}
      <div className="mb-4 space-y-1 text-sm">
        <p>
          <span className="font-semibold text-gray-700">Current End Time for Today:</span>{" "}
          <span className="text-gray-900">{booking.currentEndDateDisplay}</span>
        </p>
        <p>
          <span className="font-semibold text-gray-700">Hourly Rate:</span>{" "}
          <span className="text-gray-900">{formatCurrency(hourlyRate)}</span>
        </p>
        <p>
          <span className="font-semibold text-gray-700">Max. Extension Available Today:</span>{" "}
          <span className="text-gray-900">
            {maxHours} hour{maxHours === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      {/* Conditional Rendering: Show form only if maxHours > 0 */}
      {maxHours > 0 ? (
        <Form method="post" onSubmit={handleSubmit} className="space-y-4">
          {/* Hours Selection Dropdown */}
          <div>
            <Label htmlFor="hours" className="block mb-1 text-sm font-medium text-gray-700">
              How many hours to extend?
            </Label>
            <Select
              name="hours"
              value={hours.toString()}
              onValueChange={(value) => setHours(Number(value))}
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Hours" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxHours }, (_, i) => i + 1).map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {" "}
                    {hour} hour{hour === 1 ? "" : "s"}{" "}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Breakdown Section */}
          <div className="border-t pt-4">
            <h2 className="text-sm font-semibold mb-2 text-gray-800">Extension Cost</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  Subtotal ({hours}hr{hours === 1 ? "" : "s"})
                </dt>
                <dd className="text-gray-900">{formatCurrency(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">VAT (7.5%)</dt>
                <dd className="text-gray-900">{formatCurrency(vat)}</dd>
              </div>
              <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-dashed">
                <dt className="text-gray-900">Total Amount</dt>
                <dd className="text-gray-900">{formatCurrency(totalWithVat)}</dd>
              </div>
            </dl>
          </div>

          {/* Error Display Area */}
          {actionData?.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
              {" "}
              {actionData.error}{" "}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={hours <= 0}>
            Extend and Pay {formatCurrency(totalWithVat)}{" "}
          </Button>
        </Form>
      ) : (
        // Message shown when maxHours is 0 or less
        <div className="text-center text-gray-600 py-4 border-t mt-4">
          No further extension is available for today based on the current schedule.{" "}
        </div>
      )}
    </div>
  );
}
