import { type LoaderFunctionArgs } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { bookingIdParamSchema } from "~/schemas/review.schema";
import { getReviewByBookingId } from "~/services/reviews.server";
import { getErrorMessage, getErrorStatus } from "~/utils/errors.server";

/**
 * GET /api/reviews/booking/:bookingId
 * Get review for a specific booking
 *
 * Authentication: Not required (public endpoint)
 *
 * Params:
 * - bookingId: string (CUID)
 *
 * Response:
 * - 200: Review found (or null if no review exists)
 * - 400: Invalid booking ID
 * - 500: Server error
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { bookingId } = params;

  const paramValidation = bookingIdParamSchema.safeParse(bookingId);
  if (!paramValidation.success) {
    logger.warn("[API /api/reviews/booking/:bookingId] Invalid bookingId param", {
      errors: paramValidation.error.issues,
    });
    return Response.json(
      {
        success: false,
        error: paramValidation.error.issues[0]?.message ?? "Invalid booking ID",
      },
      { status: 400 },
    );
  }

  const validatedBookingId = paramValidation.data;

  try {
    logger.info("[API /api/reviews/booking/:bookingId] Fetching review", {
      bookingId: validatedBookingId,
    });

    const review = await getReviewByBookingId(validatedBookingId);

    return Response.json({
      success: true,
      review,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error("[API /api/reviews/booking/:bookingId] Error fetching review", {
      bookingId: validatedBookingId,
      error: errorMessage,
      statusCode,
    });

    return Response.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode },
    );
  }
}
