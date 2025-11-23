import { LoaderFunctionArgs, data } from "@remix-run/node";
import { z } from "zod";
import logger from "~/lib/logger.server";
import { validateReferralCode } from "~/services/referral.server";

// Simple in-memory rate limiting (consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_ATTEMPTS = 10; // 10 attempts per hour per IP

const ReferralCodeSchema = z
  .string()
  .length(8, "Referral code must be exactly 8 characters")
  .transform((s) => s.toUpperCase().trim())
  .refine((s) => /^[A-Z0-9]+$/.test(s), {
    message: "Referral code must contain only letters and numbers",
  });

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { code } = params;

  // Validate referral code format
  const validation = ReferralCodeSchema.safeParse(code);
  if (!validation.success) {
    return data(
      { error: "Invalid referral code format", details: validation.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Check rate limiting
  const xff = request.headers.get("x-forwarded-for");
  const clientIP =
    xff?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!checkRateLimit(clientIP)) {
    return data(
      { error: "Too many validation attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            ((rateLimitMap.get(clientIP)?.resetTime ?? 0) - Date.now()) / 1000,
          ).toString(),
          "RateLimit-Policy": `${RATE_LIMIT_MAX_ATTEMPTS};w=${RATE_LIMIT_WINDOW / 1000}`,
          "RateLimit-Limit": RATE_LIMIT_MAX_ATTEMPTS.toString(),
          "RateLimit-Remaining": Math.max(
            0,
            RATE_LIMIT_MAX_ATTEMPTS - (rateLimitMap.get(clientIP)?.count ?? 0),
          ).toString(),
          "Cache-Control": "no-store",
        },
      },
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
