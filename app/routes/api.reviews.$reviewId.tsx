import { type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import logger from "~/lib/logger.server";
import { requireAdmin, requireUser } from "~/modules/auth/auth.server";
import {
  type UpdateReviewInput,
  reviewIdParamSchema,
  updateReviewSchema,
} from "~/schemas/review.schema";
import { getReviewById, hideReview, updateReview } from "~/services/reviews.server";
import { getErrorMessage, getErrorStatus } from "~/utils/errors.server";

/**
 * GET /api/reviews/:reviewId
 * Get a specific review by ID
 *
 * Authentication: Not required (public endpoint)
 *
 * Params:
 * - reviewId: string (CUID)
 *
 * Response:
 * - 200: Review found (or null if doesn't exist)
 * - 400: Invalid review ID
 * - 500: Server error
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { reviewId } = params;

  const paramValidation = reviewIdParamSchema.safeParse(reviewId);
  if (!paramValidation.success) {
    logger.warn("[API GET /api/reviews/:reviewId] Invalid reviewId param", {
      errors: paramValidation.error.issues,
    });
    return Response.json(
      {
        success: false,
        error: paramValidation.error.issues[0]?.message ?? "Invalid review ID",
      },
      { status: 400 },
    );
  }

  const validatedReviewId = paramValidation.data;

  try {
    logger.info("[API GET /api/reviews/:reviewId] Fetching review", {
      reviewId: validatedReviewId,
    });

    const review = await getReviewById(validatedReviewId);

    return Response.json({
      success: true,
      review,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error("[API GET /api/reviews/:reviewId] Error fetching review", {
      reviewId: validatedReviewId,
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

/**
 * Parse and validate request body for update
 */
async function parseUpdateBody(
  request: Request,
): Promise<{ success: true; data: UpdateReviewInput } | { success: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn("[API PUT /api/reviews/:reviewId] Invalid JSON body", { error });
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

  const validation = updateReviewSchema.safeParse(body);
  if (!validation.success) {
    logger.warn("[API PUT /api/reviews/:reviewId] Validation failed", {
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
 * Handle PUT request to update a review
 */
async function handleUpdateReview(request: Request, reviewId: string): Promise<Response> {
  const user = await requireUser(request);

  const parseResult = await parseUpdateBody(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  try {
    logger.info("[API PUT /api/reviews/:reviewId] Updating review", {
      userId: user.id,
      reviewId,
    });

    const updatedReview = await updateReview(user.id, reviewId, parseResult.data);

    logger.info("[API PUT /api/reviews/:reviewId] Review updated successfully", {
      reviewId,
      userId: user.id,
    });

    return Response.json({
      success: true,
      review: updatedReview,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error("[API PUT /api/reviews/:reviewId] Error updating review", {
      userId: user.id,
      reviewId,
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

/**
 * Handle DELETE request to hide a review (admin only)
 */
async function handleDeleteReview(request: Request, reviewId: string): Promise<Response> {
  const user = await requireAdmin(request);

  try {
    logger.info("[API DELETE /api/reviews/:reviewId] Hiding review", {
      reviewId,
      adminId: user.id,
    });

    const hiddenReview = await hideReview(reviewId, user.id);

    logger.info("[API DELETE /api/reviews/:reviewId] Review hidden successfully", {
      reviewId,
      adminId: user.id,
    });

    return Response.json({
      success: true,
      message: "Review hidden successfully",
      review: hiddenReview,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const statusCode = getErrorStatus(error);

    logger.error("[API DELETE /api/reviews/:reviewId] Error hiding review", {
      reviewId,
      adminId: user.id,
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

/**
 * PUT /api/reviews/:reviewId
 * Update an existing review
 *
 * Authentication: Required (review owner only)
 *
 * Params:
 * - reviewId: string (CUID)
 *
 * Request body:
 * {
 *   overallRating?: number (1-5),
 *   carRating?: number (1-5),
 *   chauffeurRating?: number (1-5),
 *   serviceRating?: number (1-5),
 *   comment?: string | null
 * }
 *
 * Response:
 * - 200: Review updated successfully
 * - 400: Validation error or business rule violation
 * - 401: Unauthorized
 * - 403: Forbidden (not review owner)
 * - 404: Review not found
 * - 500: Server error
 *
 * DELETE /api/reviews/:reviewId
 * Hide a review (admin only)
 *
 * Authentication: Required (admin only)
 *
 * Params:
 * - reviewId: string (CUID)
 *
 * Response:
 * - 200: Review hidden successfully
 * - 401: Unauthorized
 * - 403: Forbidden (not admin)
 * - 404: Review not found
 * - 500: Server error
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const { reviewId } = params;

  const paramValidation = reviewIdParamSchema.safeParse(reviewId);
  if (!paramValidation.success) {
    logger.warn(`[API ${request.method} /api/reviews/:reviewId] Invalid reviewId param`, {
      errors: paramValidation.error.issues,
    });
    return Response.json(
      {
        success: false,
        error: paramValidation.error.issues[0]?.message ?? "Invalid review ID",
      },
      { status: 400 },
    );
  }

  const validatedReviewId = paramValidation.data;
  const method = request.method;

  if (method === "PUT") {
    return handleUpdateReview(request, validatedReviewId);
  }

  if (method === "DELETE") {
    return handleDeleteReview(request, validatedReviewId);
  }

  logger.warn(`[API /api/reviews/:reviewId] Method ${method} not allowed`);
  return Response.json(
    {
      success: false,
      error: `Method ${method} not allowed`,
    },
    { status: 405 },
  );
}
