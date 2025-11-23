import { LoaderFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import logger from "~/lib/logger.server";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import { checkReferralEligibility } from "~/services/referral.server";

const EligibilitySchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  type: z.enum(["DAY", "NIGHT", "FULL_DAY"], {
    errorMap: () => ({ message: "Invalid booking type" }),
  }),
});

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireUserWithRole(request, "user");
    const url = new URL(request.url);

    // Validate input
    const validation = EligibilitySchema.safeParse({
      amount: url.searchParams.get("amount"),
      type: url.searchParams.get("type"),
    });

    if (!validation.success) {
      return Response.json(
        { error: "Invalid input", details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { amount, type } = validation.data;

    const eligibility = await checkReferralEligibility(user.id, amount, type);

    return Response.json({
      eligible: eligibility.eligible,
      discountAmount: eligibility.discountAmount || 0,
      reason: eligibility.reason,
    });
  } catch (error) {
    logger.error("Failed to check referral eligibility", { error });
    return Response.json({ error: "Failed to check referral eligibility" }, { status: 500 });
  }
}
