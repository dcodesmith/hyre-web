import type { Prisma, User } from "@prisma/client";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  redirect,
  Form,
  useActionData,
  useLoaderData,
  useSubmit,
} from "react-router";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import {
  addDays,
  addHours,
  differenceInHours,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import Decimal from "decimal.js";
import { Calendar, Car, Clock, CreditCard } from "lucide-react";
import crypto from "node:crypto";
import { useMemo, useState } from "react";
import invariant from "tiny-invariant";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import logger from "~/lib/logger.server";
import { formatCurrency, getCustomerDetails } from "~/lib/utils";
import { prisma } from "~/modules/db/db.server";
import { calculateExtensionFinancials, getRates } from "~/services/extensions.server";
import { createPaymentIntent } from "~/services/payment.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { env } from "~/utils/server/env.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  invariant(params.id, "Booking ID route parameter is required");
  logger.info(`Starting loader for booking ID: ${params.id}`);

  const url = new URL(request.url);
  const guestEmail = url.searchParams.get("email");
  const now = new Date();
  const today = startOfDay(now); // Midnight today

  const bookingData = await prisma.booking.findUnique({
    where: { id: params.id, status: "ACTIVE" },
    include: { car: true, user: true, legs: { include: { extensions: true } } },
  });

  if (!bookingData) {
    throw new Response("Booking not found", { status: 404 });
  }

  const hourlyRate = Number(bookingData.car.hourlyRate);

  // Validate domain invariant: hourlyRate must exist and be positive
  if (!hourlyRate || hourlyRate <= 0) {
    logger.error(
      `Invalid hourly rate for car ${bookingData.car.id}: ${bookingData.car.hourlyRate}`,
    );
    throw new Response("Car hourly rate is not configured properly. Cannot extend booking.", {
      status: 500,
    });
  }

  const booking = {
    ...bookingData,
    startDate: new Date(bookingData.startDate),
    endDate: new Date(bookingData.endDate),
    platformCustomerServiceFeeRatePercent: Number(
      bookingData.platformCustomerServiceFeeRatePercent,
    ),
    car: {
      ...bookingData.car,
      hourlyRate,
      dayRate: Number(bookingData.car.dayRate),
      nightRate: Number(bookingData.car.nightRate),
      fullDayRate: Number(bookingData.car.fullDayRate),
    },
  };

  const rates = await getRates();
  const vatRatePercent = Number(rates.vatRatePercent);

  const overallBookingStartDate = booking.startDate;
  const overallBookingEndDate = booking.endDate;

  // --- User Authentication & Authorization ---
  let user: { email: string; name?: string; phoneNumber?: string } | null | User = null;

  try {
    if (guestEmail) {
      if (!booking.guestUser || (booking.guestUser as { email: string }).email !== guestEmail) {
        const maskedEmail = `${guestEmail[0]}***${guestEmail.substring(guestEmail.indexOf("@"))}`;
        logger.error(`Unauthorized guest access: ${maskedEmail}`);
        throw new Response("Unauthorized guest access", { status: 403 });
      }
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

  if (now < overallBookingStartDate || now >= overallBookingEndDate) {
    logger.warn(
      `Current time ${now.toISOString()} is outside overall booking period ${overallBookingStartDate.toISOString()} - ${overallBookingEndDate.toISOString()}.`,
    );
    throw new Response("Booking is not within its scheduled start and end dates.", { status: 400 });
  }

  logger.info(`Booking ${booking.id} is ACTIVE and within overall time frame.`);

  // Check if this is a FULL_DAY booking - they cannot be extended
  if (booking.type === "FULL_DAY") {
    logger.warn(`Extension attempt blocked for FULL_DAY booking: ${booking.id}`);
    throw new Response("24-hour bookings cannot be extended.", { status: 400 });
  }

  // --- Calculate Current State for Today, based on Today's Leg and its Extensions ---
  const todaysLeg = booking.legs.find((leg) => isSameDay(leg.legDate, today));

  if (!todaysLeg) {
    logger.error(`Loader: No active leg found for booking ${booking.id} on ${today.toISOString()}`);
    throw new Response("No active booking segment found for today.", { status: 400 });
  }

  logger.info(`Loader: Today's leg ID: ${todaysLeg.id}, Date: ${todaysLeg.legDate}`);

  const todaysLegOriginalEndTime = todaysLeg.legEndTime;

  const latestConfirmedExtensionForTodaysLeg = todaysLeg.extensions
    .filter(
      (ext) =>
        ext.status === "ACTIVE" &&
        ext.paymentStatus === "PAID" &&
        ext.extensionEndTime &&
        isSameDay(ext.extensionEndTime, today),
    )
    .sort((a, b) => b.extensionEndTime.getTime() - a.extensionEndTime.getTime())[0];

  let currentEndTimeToday: Date;

  if (latestConfirmedExtensionForTodaysLeg?.extensionEndTime) {
    currentEndTimeToday = latestConfirmedExtensionForTodaysLeg.extensionEndTime;

    logger.info(
      `Loader: Confirmed extension (ID: ${latestConfirmedExtensionForTodaysLeg.id}) found for today's leg. Current end time for today is ${currentEndTimeToday.toISOString()}.`,
    );
  } else {
    currentEndTimeToday = todaysLegOriginalEndTime;
    logger.info(
      `Loader: No confirmed extension for today's leg. Current end time for today is leg's original end time: ${currentEndTimeToday.toISOString()}.`,
    );
  }

  if (now >= currentEndTimeToday) {
    logger.warn(
      `Loader: Current time ${now.toISOString()} is past today's effective end time ${currentEndTimeToday.toISOString()}. Booking ID: ${booking.id}`,
    );
    const message = latestConfirmedExtensionForTodaysLeg
      ? "The extended time for today has already ended. Cannot extend further."
      : "The active time for today has already ended. Cannot extend.";
    throw new Response(message, { status: 400 });
  }
  logger.info(
    `Loader: Booking ${booking.id} is eligible for extension consideration today. Current end: ${currentEndTimeToday.toISOString()}`,
  );

  // --- Calculate Max Extension Limit for Today (maxEndToday) ---
  const hardLimit = startOfDay(addDays(today, 1)); // Midnight next day
  logger.info(`Loader: Hard limit for extension (midnight next day): ${hardLimit.toISOString()}`);

  // Max end for today is now strictly midnight.
  const maxEndToday = hardLimit;
  logger.info(
    `Loader: Max end for today for booking ${booking.id} is set to midnight: ${maxEndToday.toISOString()}`,
  );

  // --- Calculate max hours ---
  const maxHours = differenceInHours(maxEndToday, currentEndTimeToday);
  const validMaxHours = maxHours > 0 ? maxHours : 0;
  logger.info(
    `Loader: Calculated max extension hours for booking ${booking.id}: ${validMaxHours} (MaxEnd: ${maxEndToday.toISOString()}, CurrentEnd: ${currentEndTimeToday.toISOString()})`,
  );

  if (validMaxHours < 1) {
    let reasonDetail = "";
    // Since maxEndToday is now always hardLimit (midnight)
    if (currentEndTimeToday >= hardLimit) {
      reasonDetail = "The current end time for today is already at or past midnight.";
    } else {
      // This implies currentEndTimeToday is close to midnight.
      reasonDetail =
        "The daily extension limit (midnight) is too close to allow a full one-hour extension, or has been reached.";
    }

    const baseMessage = latestConfirmedExtensionForTodaysLeg
      ? "No further extension is possible today."
      : "Extension is not possible today.";
    const fullMessage = `${baseMessage} ${reasonDetail}`;

    logger.warn(
      `Loader: Max hours < 1 for booking ${booking.id}. Current end: ${currentEndTimeToday.toISOString()}, Max end: ${maxEndToday.toISOString()}. Reason: ${fullMessage}`,
    );
    throw new Response(fullMessage, { status: 400 });
  }

  // --- Return Data ---
  logger.info(
    `Loader finished successfully for booking ${booking.id}. Max hours: ${validMaxHours}`,
  );

  return {
    booking: {
      ...booking,
      currentEndDateDisplay: format(currentEndTimeToday, "LLL do p"),
      user,
    },
    maxHours: validMaxHours,
    vatRatePercent,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  await validateCSRF(request);

  invariant(params.id, "Booking ID route parameter is required");
  logger.info(`Starting action for booking ID: ${params.id}`);

  const formData = await request.formData();
  const hours = Number(formData.get("hours"));

  if (!hours || hours < 1 || !Number.isInteger(hours)) {
    logger.error(`Invalid hours value: ${hours}`);
    return data({ error: "Please select a valid number of hours." }, { status: 400 });
  }

  const now = new Date();

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: params.id, status: "ACTIVE" },
      include: {
        car: true,
        user: true,
        legs: {
          where: {
            legDate: {
              gte: startOfDay(now),
              lte: endOfDay(now),
            },
          },
          include: { extensions: true },
        },
      },
    });

    if (!booking || !booking.car) {
      logger.error(`Booking not found: ${params.id}`);
      return data({ error: "Booking not found" }, { status: 404 });
    }

    // Validate domain invariant: hourlyRate must exist and be positive
    const hourlyRate = Number(booking.car.hourlyRate);
    if (!hourlyRate || hourlyRate <= 0) {
      logger.error(`Invalid hourly rate for car ${booking.car.id}: ${booking.car.hourlyRate}`);
      return data(
        { error: "Car hourly rate is not configured properly. Cannot extend booking." },
        { status: 500 },
      );
    }

    // Authorization: mirror loader behavior
    const url = new URL(request.url);
    const guestEmail = url.searchParams.get("email");

    if (guestEmail) {
      if (!booking.guestUser || (booking.guestUser as { email: string }).email !== guestEmail) {
        return data({ error: "Unauthorized guest access" }, { status: 403 });
      }
    } else {
      const loggedInUser = await requireUserWithRole(request, "user");
      if (loggedInUser.id !== booking.userId) {
        return data({ error: "Booking does not belong to this user" }, { status: 403 });
      }
    }

    // Check if this is a FULL_DAY booking - they cannot be extended
    if (booking.type === "FULL_DAY") {
      logger.warn(`Extension attempt blocked for FULL_DAY booking in action: ${booking.id}`);
      return data({ error: "24-hour bookings cannot be extended." }, { status: 400 });
    }

    const {
      platformCustomerServiceFeeRatePercent,
      platformFleetOwnerCommissionRatePercent,
      vatRatePercent,
    } = await getRates();

    const todaysLeg = booking.legs[0];

    if (!todaysLeg) {
      logger.error(`Action: No active leg found for booking ${booking.id} today`);
      return data({ error: "No active booking segment found for today." }, { status: 400 });
    }

    const latestConfirmedExtension = todaysLeg.extensions
      .filter(
        (ext) =>
          ext.status === "ACTIVE" &&
          ext.paymentStatus === "PAID" &&
          ext.extensionEndTime &&
          isSameDay(new Date(ext.extensionEndTime), startOfDay(now)),
      )
      .sort(
        (a, b) => new Date(b.extensionEndTime).getTime() - new Date(a.extensionEndTime).getTime(),
      )[0];
    const effectiveEndTime = latestConfirmedExtension?.extensionEndTime ?? todaysLeg.legEndTime;
    const maxEndTodayInAction = startOfDay(addDays(now, 1));
    const maxExtensionHours = Math.max(0, differenceInHours(maxEndTodayInAction, effectiveEndTime));

    logger.info(
      `Recalculated maxHours for validation (action): ${maxExtensionHours}. Max end today (midnight): ${maxEndTodayInAction.toISOString()}`,
    );

    if (hours > maxExtensionHours) {
      logger.error(`Submitted hours (${hours}) exceeds max allowed (${maxExtensionHours}).`);
      return data(
        {
          error: `Cannot extend by ${hours} hours. Maximum currently available is ${maxExtensionHours} hour(s). Please refresh or try again.`,
        },
        { status: 400 },
      );
    }

    const newEndDateTimeForLeg = addHours(effectiveEndTime, hours);

    logger.info(
      `Calculated new proposed end date for today's extension: ${newEndDateTimeForLeg.toISOString()}`,
    );

    logger.info(`No PENDING extension. Creating new one for leg ${todaysLeg.id}.`);

    const financials = await calculateExtensionFinancials(
      hourlyRate,
      hours,
      platformCustomerServiceFeeRatePercent,
      platformFleetOwnerCommissionRatePercent,
      vatRatePercent,
    );

    const { checkoutUrl, paymentIntentId } = await createPaymentIntent({
      amount: financials.totalAmount.toNumber(),
      customer: getCustomerDetails(booking),
      metadata: {
        transactionType: "booking_extension",
      },
      idempotencyKey: crypto.randomUUID(), // Always new idempotency key for new/updated PI
      callbackUrl: `${env.DOMAIN}/bookings/payment-status?transactionType=booking_extension`,
    });

    logger.debug(`Payment intent created: ${paymentIntentId}`);

    const createClause: Prisma.ExtensionCreateInput = {
      eventType: "HOURLY_ADDITION",
      extensionStartTime: effectiveEndTime,
      extendedDurationHours: hours,
      extensionEndTime: newEndDateTimeForLeg,
      totalAmount: financials.totalAmount,
      netTotal: financials.netTotal,
      platformCustomerServiceFeeRatePercent: financials.platformCustomerServiceFeeRatePercent,
      platformCustomerServiceFeeAmount: financials.platformCustomerServiceFeeAmount,
      subtotalBeforeVat: financials.subtotalBeforeVat,
      vatRatePercent: financials.vatRatePercent,
      vatAmount: financials.vatAmount,
      platformFleetOwnerCommissionRatePercent: financials.platformFleetOwnerCommissionRatePercent,
      platformFleetOwnerCommissionAmount: financials.platformFleetOwnerCommissionAmount,
      fleetOwnerPayoutAmountNet: financials.fleetOwnerPayoutAmountNet,
      bookingLeg: { connect: { id: todaysLeg.id } },
      paymentIntent: paymentIntentId,
    };

    const extension = await prisma.extension.create({ data: createClause });

    logger.debug("Extension created:", extension);

    logger.info(`Redirecting to Flutterwave checkout: ${checkoutUrl}`);

    return redirect(checkoutUrl);
  } catch (error) {
    logger.error(
      `Payment intent creation failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    return data({ error: "Failed to initialize payment. Please try again." }, { status: 500 });
  }
}

export default function ExtendBookingPage() {
  const { booking, maxHours, vatRatePercent } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const csrfToken = useAuthenticityToken();
  const [hours, setHours] = useState(maxHours >= 1 ? 1 : 0);

  // Financial calculations using Decimal end-to-end with consistent precision
  const calculations = useMemo(() => {
    const hourlyRate = booking.car.hourlyRate;
    const platformServiceFeeRate = booking.platformCustomerServiceFeeRatePercent ?? 0;
    const vatRate = vatRatePercent ?? 0;

    // All calculations in Decimal, no mixed number arithmetic
    const total = new Decimal(hourlyRate).mul(hours);
    const platformServiceFee = total.mul(Math.max(platformServiceFeeRate, 0)).div(100);
    const subtotalBeforeVat = total.plus(platformServiceFee);
    const vatAmount = subtotalBeforeVat.mul(vatRate).div(100);
    const totalWithVat = subtotalBeforeVat.plus(vatAmount);

    // Apply consistent rounding policy: 2 decimal places for currency precision
    return {
      hourlyRate,
      total: total.toDecimalPlaces(2).toNumber(),
      platformServiceFeeRate,
      platformServiceFee: platformServiceFee.toDecimalPlaces(2).toNumber(),
      subtotalBeforeVat: subtotalBeforeVat.toDecimalPlaces(2).toNumber(),
      vatRate,
      vatAmount: vatAmount.toDecimalPlaces(2).toNumber(),
      totalWithVat: totalWithVat.toDecimalPlaces(2).toNumber(),
    };
  }, [
    booking.car.hourlyRate,
    booking.platformCustomerServiceFeeRatePercent,
    hours,
    vatRatePercent,
  ]);

  const {
    hourlyRate,
    total,
    platformServiceFeeRate,
    platformServiceFee,
    vatRate,
    vatAmount,
    totalWithVat,
  } = calculations;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hours <= 0) return; // Don't submit if 0 hours
    const formData = new FormData(event.currentTarget);

    formData.append("csrf", csrfToken);
    submit(formData, { method: "POST", action: `/bookings/${booking.id}/extend` });
  };

  return (
    <div className="w-full max-w-md mx-auto p-3 sm:p-4">
      <Card className="w-full rounded">
        <CardHeader className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">Extend Trip</CardTitle>
              <p className="text-sm text-muted-foreground">
                {booking.car.make} {booking.car.model} ({booking.car.year})
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6">
          {/* Current Booking Info */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Current End Time:</span>
              <span className="font-semibold">{booking.currentEndDateDisplay}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Hourly Rate:</span>
              <span className="font-semibold">{formatCurrency(hourlyRate)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-bold rounded bg-neutral-200">
                Max {maxHours} hour{maxHours === 1 ? "" : "s"} available
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Extension Selection */}
          <Form method="post" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-2 sm:space-y-3">
              <label htmlFor="hours" className="text-sm font-medium">
                How many hours would you like to extend by?
              </label>
              <Select
                name="hours"
                value={hours.toString()}
                onValueChange={(value) => setHours(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Hours" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxHours }, (_, i) => i + 1).map((hour) => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {hour} hour{hour > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Cost Breakdown */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="font-bold">Extension Cost</span>
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({hours}hr{hours > 1 ? "s" : ""})
                  </span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>

                {platformServiceFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Platform Fee ({platformServiceFeeRate.toString()}%)
                    </span>
                    <span className="font-medium">{formatCurrency(platformServiceFee)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT ({vatRate.toString()}%)</span>
                  <span className="font-medium">{formatCurrency(vatAmount)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-sm font-bold">
                  <span>Total Amount</span>
                  <span>{formatCurrency(totalWithVat)}</span>
                </div>
              </div>
            </div>

            {/* Error Display Area */}
            {actionData?.error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
                {" "}
                {actionData.error}{" "}
              </div>
            )}

            {/* Action Button */}
            <Button className="w-full text-sm font-medium">
              Extend and Pay {formatCurrency(totalWithVat)}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
