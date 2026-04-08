import { endOfDay, isValid, parse, startOfDay, subDays } from "date-fns";
import { LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const ReconciliationQuerySchema = z.object({
  from: z.string().regex(DATE_ONLY_REGEX, "from must be YYYY-MM-DD").optional(),
  to: z.string().regex(DATE_ONLY_REGEX, "to must be YYYY-MM-DD").optional(),
  limit: z.coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(MAX_LIMIT, `limit must be at most ${MAX_LIMIT}`)
    .optional(),
});

function parseDateInput(input: string | undefined, mode: "start" | "end"): Date | null {
  if (!input) return null;
  const parsed = parse(input, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return null;
  return mode === "start" ? startOfDay(parsed) : endOfDay(parsed);
}

function getDefaultRange(): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  const from = startOfDay(subDays(to, 29));
  return { from, to };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);
  const url = new URL(request.url);
  const queryValidation = ReconciliationQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!queryValidation.success) {
    return Response.json(
      {
        error: queryValidation.error.issues[0]?.message ?? "Invalid query parameters",
      },
      { status: 400 },
    );
  }

  const { from: fromInput, to: toInput, limit: parsedLimit } = queryValidation.data;

  const fallbackRange = getDefaultRange();
  const parsedFrom = parseDateInput(fromInput, "start");
  const parsedTo = parseDateInput(toInput, "end");
  const limit = parsedLimit ?? DEFAULT_LIMIT;

  let from = parsedFrom ?? fallbackRange.from;
  let to = parsedTo ?? fallbackRange.to;
  if (from > to) {
    [from, to] = [to, from];
  }

  const bookings = await prisma.booking.findMany({
    where: {
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      bookingReference: true,
      createdAt: true,
      paymentStatus: true,
      overallPayoutStatus: true,
      totalAmount: true,
      fleetOwnerPayoutAmountNet: true,
      referralDiscountAmount: true,
      referralCreditsUsed: true,
      vatAmount: true,
      platformFleetOwnerCommissionAmount: true,
    },
  });

  const rows = bookings.map((booking) => {
    const referralDiscountAmount = booking.referralDiscountAmount?.toNumber() ?? 0;
    const referralCreditsUsed = booking.referralCreditsUsed?.toNumber() ?? 0;
    const customerBenefitAmount = referralDiscountAmount + referralCreditsUsed;

    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      createdAt: booking.createdAt,
      paymentStatus: booking.paymentStatus,
      overallPayoutStatus: booking.overallPayoutStatus,
      totalAmount: booking.totalAmount?.toNumber() ?? 0,
      fleetOwnerPayoutAmountNet: booking.fleetOwnerPayoutAmountNet?.toNumber() ?? 0,
      referralDiscountAmount,
      referralCreditsUsed,
      customerBenefitAmount,
      vatAmount: booking.vatAmount?.toNumber() ?? 0,
      platformFleetOwnerCommissionAmount:
        booking.platformFleetOwnerCommissionAmount?.toNumber() ?? 0,
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      // Accumulate as integers to avoid floating-point drift
      acc.totalAmount += Math.round(row.totalAmount * 100);
      acc.totalFleetOwnerPayout += Math.round(row.fleetOwnerPayoutAmountNet * 100);
      acc.totalReferralDiscount += Math.round(row.referralDiscountAmount * 100);
      acc.totalReferralCreditsUsed += Math.round(row.referralCreditsUsed * 100);
      acc.totalCustomerBenefit += Math.round(row.customerBenefitAmount * 100);
      acc.totalVat += Math.round(row.vatAmount * 100);
      acc.totalFleetOwnerCommission += Math.round(row.platformFleetOwnerCommissionAmount * 100);
      return acc;
    },
    {
      bookingCount: rows.length,
      totalAmount: 0,
      totalFleetOwnerPayout: 0,
      totalReferralDiscount: 0,
      totalReferralCreditsUsed: 0,
      totalCustomerBenefit: 0,
      totalVat: 0,
      totalFleetOwnerCommission: 0,
    },
  );

  summary.totalReferralDiscount /= 100;
  summary.totalReferralCreditsUsed /= 100;
  summary.totalCustomerBenefit /= 100;
  summary.totalVat /= 100;
  summary.totalFleetOwnerCommission /= 100;

  // Convert back to naira for response
  summary.totalAmount /= 100;
  summary.totalFleetOwnerPayout /= 100;

  return Response.json(
    {
      filters: {
        from,
        to,
        limit,
      },
      summary,
      rows,
    },
    { headers: { "Cache-Control": "no-store, private, must-revalidate", Vary: "Cookie" } },
  );
}
