import { LoaderFunctionArgs, data } from "react-router";
import { z } from "zod";
import logger from "~/lib/logger.server";
import { validateReferralCode } from "~/services/referral.server";
import { checkReferralValidationRateLimit } from "~/utils/server/rate-limit.server";

const ReferralCodeSchema = z
  .string()
  .length(8, "Referral code must be exactly 8 characters")
  .transform((s) => s.toUpperCase())
  .refine((s) => /^[A-Z0-9]+$/.test(s), {
    error: "Referral code must contain only letters and numbers",
  });

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { code } = params;

  const rateLimit = await checkReferralValidationRateLimit(request);
  if (!rateLimit.allowed) {
    return data(
      { error: rateLimit.message },
      {
        status: rateLimit.status ?? 429,
        headers: rateLimit.headers,
      },
    );
  }

  // Validate referral code format
  const validation = ReferralCodeSchema.safeParse(code);
  if (!validation.success) {
    return data(
      {
        error: "Invalid referral code format",
        details: validation.error.issues.map((issue) => issue.message),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    // Get user email from query params for self-referral check
    const url = new URL(request.url);
    const userEmail = url.searchParams.get("email") || "";

    const referrer = await validateReferralCode(validation.data, userEmail);

    return {
      valid: true,
      referrer: {
        name: referrer?.name ?? "Anonymous",
      },
      message: "Valid referral code.",
    };
  } catch (error) {
    logger.error("Failed to validate referral code", { error });

    // Map specific error messages to appropriate status codes
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "The referral code you entered is invalid.") {
      return data(
        { error: errorMessage },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (errorMessage === "You cannot refer yourself.") {
      return data(
        { error: errorMessage },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    // All other exceptions
    return data(
      { error: "Failed to validate referral code" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
