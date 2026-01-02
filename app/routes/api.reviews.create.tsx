import { type ActionFunctionArgs } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { requireUser } from "~/modules/auth/auth.server";
import { createReviewSchema, type CreateReviewInput } from "~/schemas/review.schema";
import { createReview } from "~/services/reviews.server";
import { getErrorMessage, getErrorStatus } from "~/utils/errors.server";

/**
 * Parse and validate request body for create review
 */
async function parseCreateBody(
  request: Request,
): Promise<{ success: true; data: CreateReviewInput } | { success: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn("[API /api/reviews/create] Invalid JSON body", { error });
    return {
      success: false,
      response: Response.json(
        {
          success: false,
          error: "Invalid request body",
        },
        { status: 400 },
      ),
    };
  }

  const validation = createReviewSchema.safeParse(body);
  if (!validation.success) {
    logger.warn("[API /api/reviews/create] Validation failed", {
      errors: validation.error.issues,
    });
    return {
      success: false,
      response: Response.json(
        {
          success: false,
          error: validation.error.issues[0]?.message ?? "Invalid input",
          errors: validation.error.issues,
        },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: validation.data };
}

/**
 * POST /api/reviews/create
 * Create a new review for a completed booking
 *
 * Authentication: Required (customer who made the booking)
 *
 * Request body:
 * {
 *   bookingId: string,
 *   overallRating: number (1-5),
 *   carRating: number (1-5),
 *   chauffeurRating: number (1-5),
 *   serviceRating: number (1-5),
 *   comment?: string (optional, max 2000 chars)
 * }
 *
 * Response:
 * - 201: Review created successfully
 * - 400: Validation error or business rule violation
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);

  const parseResult = await parseCreateBody(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  try {
    logger.info("[API /api/reviews/create] Creating review", {
      userId: user.id,
      bookingId: parseResult.data.bookingId,
    });

    const review = await createReview(user.id, parseResult.data);

    logger.info("[API /api/reviews/create] Review created successfully", {
      reviewId: review.id,
      bookingId: parseResult.data.bookingId,
      userId: user.id,
    });

    return Response.json(
      {
        success: true,
        review,
      },
      { status: 201 },
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error("[API /api/reviews/create] Error creating review", {
      userId: user.id,
      bookingId: parseResult.data.bookingId,
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
